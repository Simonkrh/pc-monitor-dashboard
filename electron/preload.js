const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "pcMonitorDesktop",
  Object.freeze({
    isElectron: true,
    platform: process.platform,
    showBrowserPage: (url) => ipcRenderer.send("browser-page:show", url),
    hideBrowserPage: () => ipcRenderer.send("browser-page:hide"),
    goBackBrowserPage: () => ipcRenderer.send("browser-page:back"),
  }),
);
