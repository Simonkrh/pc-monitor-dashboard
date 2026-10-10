const {
  app,
  BrowserWindow,
  WebContentsView,
  dialog,
  ipcMain,
  shell,
} = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_URL = "http://127.0.0.1:8080";
const BACKEND_URL = "http://127.0.0.1:5000";
const START_SERVICES = !process.argv.includes("--no-start-services");
const FULLSCREEN = process.argv.includes("--fullscreen");
const BROWSER_TOOLBAR_HEIGHT = 64;

let mainWindow = null;
let browserPageView = null;
let browserPageAttached = false;
let browserPageUrl = null;
let isQuitting = false;
const childProcesses = new Set();

function isHttpUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function serverResponds(url, timeoutMs = 700) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(true);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await serverResponds(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

function pythonCandidates() {
  if (process.env.PC_MONITOR_PYTHON) {
    return [{ command: process.env.PC_MONITOR_PYTHON, prefixArgs: [] }];
  }

  if (process.platform === "win32") {
    return [
      { command: "py", prefixArgs: ["-3"] },
      { command: "python", prefixArgs: [] },
    ];
  }

  return [
    { command: "python3", prefixArgs: [] },
    { command: "python", prefixArgs: [] },
  ];
}

async function spawnPython(scriptPath, serviceName) {
  let lastError = null;

  for (const candidate of pythonCandidates()) {
    try {
      const child = await new Promise((resolve, reject) => {
        const processHandle = spawn(
          candidate.command,
          [...candidate.prefixArgs, scriptPath],
          {
            cwd: ROOT_DIR,
            env: { ...process.env, PYTHONUNBUFFERED: "1" },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );

        processHandle.once("spawn", () => resolve(processHandle));
        processHandle.once("error", reject);
      });

      childProcesses.add(child);
      child.stdout.on("data", (data) => {
        process.stdout.write(`[${serviceName}] ${data}`);
      });
      child.stderr.on("data", (data) => {
        process.stderr.write(`[${serviceName}] ${data}`);
      });
      child.once("exit", (code, signal) => {
        childProcesses.delete(child);
        if (!isQuitting && code !== 0) {
          console.error(
            `${serviceName} stopped unexpectedly (code=${code}, signal=${signal}).`,
          );
        }
      });
      return child;
    } catch (error) {
      lastError = error;
      if (error.code !== "ENOENT") break;
    }
  }

  const detail = lastError?.message || "No Python 3 executable was found.";
  throw new Error(`Could not start ${serviceName}: ${detail}`);
}

async function startLocalServices() {
  const [backendIsRunning, frontendIsRunning] = await Promise.all([
    serverResponds(BACKEND_URL),
    serverResponds(FRONTEND_URL),
  ]);

  if (!backendIsRunning) {
    await spawnPython(path.join(ROOT_DIR, "backend", "app.py"), "backend");
  }
  if (!frontendIsRunning) {
    await spawnPython(
      path.join(ROOT_DIR, "frontend", "webserver.py"),
      "frontend",
    );
  }

  const frontendReady = await waitForServer(FRONTEND_URL, 25_000);
  if (!frontendReady) {
    throw new Error(
      `The frontend did not become available at ${FRONTEND_URL}. ` +
        "Check that Python 3 and the packages in requirements.txt are installed.",
    );
  }

  // The UI can still open when the backend is hosted on another PC, so a local
  // backend startup failure is reported in the console rather than blocking it.
  if (!(await waitForServer(BACKEND_URL, 5_000))) {
    console.warn(`The local backend is not responding at ${BACKEND_URL}.`);
  }
}

function stopLocalServices() {
  isQuitting = true;
  for (const child of childProcesses) {
    if (!child.killed) child.kill();
  }
  childProcesses.clear();
}

function layoutBrowserPage() {
  if (!mainWindow || !browserPageView || !browserPageAttached) return;
  const [width, height] = mainWindow.getContentSize();
  browserPageView.setBounds({
    x: 0,
    y: BROWSER_TOOLBAR_HEIGHT,
    width,
    height: Math.max(0, height - BROWSER_TOOLBAR_HEIGHT),
  });
}

function createBrowserPageView() {
  if (browserPageView) return browserPageView;

  browserPageView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      partition: "persist:browser-page",
    },
  });

  browserPageView.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void browserPageView.webContents.loadURL(url);
    return { action: "deny" };
  });

  browserPageView.webContents.on("will-navigate", (event, url) => {
    if (!isHttpUrl(url)) event.preventDefault();
  });

  browserPageView.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );

  return browserPageView;
}

function showBrowserPage(url) {
  if (!mainWindow || !isHttpUrl(url)) {
    hideBrowserPage();
    return;
  }

  const view = createBrowserPageView();
  if (!browserPageAttached) {
    mainWindow.contentView.addChildView(view);
    browserPageAttached = true;
  }
  layoutBrowserPage();

  if (browserPageUrl !== url) {
    browserPageUrl = url;
    void view.webContents.loadURL(url);
  }
}

function hideBrowserPage() {
  if (!mainWindow || !browserPageView || !browserPageAttached) return;
  mainWindow.contentView.removeChildView(browserPageView);
  browserPageAttached = false;
}

ipcMain.on("browser-page:show", (event, url) => {
  if (event.sender !== mainWindow?.webContents) return;
  showBrowserPage(typeof url === "string" ? url : "");
});

ipcMain.on("browser-page:hide", (event) => {
  if (event.sender !== mainWindow?.webContents) return;
  hideBrowserPage();
});

ipcMain.on("browser-page:back", (event) => {
  if (event.sender !== mainWindow?.webContents || !browserPageView) return;
  if (browserPageView.webContents.navigationHistory.canGoBack()) {
    browserPageView.webContents.navigationHistory.goBack();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 600,
    minWidth: 800,
    minHeight: 480,
    fullscreen: FULLSCREEN,
    autoHideMenuBar: true,
    backgroundColor: "#101418",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const targetOrigin = new URL(url).origin;
    if (targetOrigin === new URL(FRONTEND_URL).origin) return;

    event.preventDefault();
    if (isHttpUrl(url)) void shell.openExternal(url);
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("resize", layoutBrowserPage);
  mainWindow.on("closed", () => {
    if (browserPageView && !browserPageView.webContents.isDestroyed()) {
      browserPageView.webContents.close();
    }
    browserPageView = null;
    browserPageAttached = false;
    browserPageUrl = null;
    mainWindow = null;
  });
}

async function loadDashboard() {
  createWindow();
  await mainWindow.loadFile(path.join(__dirname, "loading.html"));
  mainWindow.show();

  try {
    if (START_SERVICES) {
      await startLocalServices();
    } else if (!(await waitForServer(FRONTEND_URL, 2_000))) {
      throw new Error(
        `No frontend is running at ${FRONTEND_URL}. Start frontend/webserver.py first.`,
      );
    }
    await mainWindow.loadURL(FRONTEND_URL);
  } catch (error) {
    console.error(error);
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "PC Monitor Dashboard could not start",
      message: "The local dashboard could not be opened.",
      detail: error.message,
    });
    app.quit();
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(loadDashboard);
}

app.on("before-quit", stopLocalServices);
app.on("window-all-closed", () => app.quit());
