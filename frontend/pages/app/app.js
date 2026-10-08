const SWIPE_PAGES = ["/dashboard", "/spotify", "/timers", "/resources"];
const MANAGED_PAGES = new Set([...SWIPE_PAGES, "/settings"]);
const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/spotify": "Spotify",
  "/timers": "Timers",
  "/resources": "Resources",
  "/settings": "Settings",
};

const viewContainer = document.getElementById("app-views");
const views = new Map();
let activePath = null;
let preloadTimer = null;

function getHiddenPages() {
  try {
    return JSON.parse(localStorage.getItem("hiddenPages") || "[]");
  } catch {
    return [];
  }
}

function getVisibleSwipePages() {
  const hiddenPages = getHiddenPages();
  const visiblePages = SWIPE_PAGES.filter((page) => !hiddenPages.includes(page));
  return visiblePages.length ? visiblePages : ["/dashboard"];
}

function getDefaultPage() {
  const visiblePages = getVisibleSwipePages();
  const savedPage = localStorage.getItem("defaultPage") || "/dashboard";
  return visiblePages.includes(savedPage) ? savedPage : visiblePages[0];
}

function getHashPath() {
  const path = decodeURIComponent(window.location.hash.slice(1));
  if (!MANAGED_PAGES.has(path)) return getDefaultPage();
  if (SWIPE_PAGES.includes(path) && !getVisibleSwipePages().includes(path)) {
    return getDefaultPage();
  }
  return path;
}

function createView(path) {
  if (views.has(path)) return views.get(path);

  const view = document.createElement("iframe");
  view.className = "app-view";
  view.dataset.path = path;
  view.title = PAGE_TITLES[path] || "Dashboard page";
  view.src = path;
  view.setAttribute("aria-hidden", "true");
  viewContainer.appendChild(view);
  views.set(path, view);

  view.addEventListener("load", () => {
    notifyViewStates();

    // Open admin pages in the main window when an embedded page navigates to one.
    try {
      const loadedPath = view.contentWindow.location.pathname;
      if (loadedPath !== path && !MANAGED_PAGES.has(loadedPath)) {
        window.location.assign(loadedPath);
      }
    } catch {
      // A browser blocks access to an iframe URL when it belongs to another site.
    }
  });

  return view;
}

function notifyViewStates() {
  for (const [path, view] of views) {
    view.contentWindow?.postMessage(
      { type: "pc-monitor:view-state", active: path === activePath },
      window.location.origin,
    );
  }
}

function preloadNeighborViews() {
  clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    const pages = getVisibleSwipePages();
    const index = pages.indexOf(activePath);
    if (index === -1 || pages.length < 2) return;

    createView(pages[(index + 1) % pages.length]);
    createView(pages[(index - 1 + pages.length) % pages.length]);
    notifyViewStates();
  }, 500);
}

function showView(path, historyMode = "push") {
  if (!MANAGED_PAGES.has(path)) {
    window.location.assign(path);
    return;
  }

  const nextView = createView(path);
  for (const [viewPath, view] of views) {
    const isActive = viewPath === path;
    view.classList.toggle("active", isActive);
    view.setAttribute("aria-hidden", String(!isActive));
  }

  activePath = path;
  document.title = `${PAGE_TITLES[path]} · PC Monitor Dashboard`;

  const nextUrl = `/app#${path}`;
  if (historyMode === "replace") {
    history.replaceState({ path }, "", nextUrl);
  } else if (historyMode === "push" && window.location.hash !== `#${path}`) {
    history.pushState({ path }, "", nextUrl);
  }

  notifyViewStates();
  preloadNeighborViews();
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "pc-monitor:navigate") return;

  const isKnownView = [...views.values()].some(
    (view) => view.contentWindow === event.source,
  );
  if (!isKnownView) return;

  showView(event.data.path);
});

window.addEventListener("popstate", () => showView(getHashPath(), "none"));

window.addEventListener("storage", (event) => {
  if (!["hiddenPages", "defaultPage"].includes(event.key)) return;
  if (SWIPE_PAGES.includes(activePath) && !getVisibleSwipePages().includes(activePath)) {
    showView(getDefaultPage(), "replace");
  } else {
    preloadNeighborViews();
  }
});

showView(getHashPath(), "replace");
