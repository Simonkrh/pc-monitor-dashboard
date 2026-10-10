let startX = 0;
let startY = 0;
let moveX = 0;
let moveY = 0;
let isMouseDown = false;
let ignoreSwipe = false;
const NAVIGATION_DELAY_MS = 300;

function getSwipeThreshold() {
  const base = Math.round(window.innerWidth * 0.18);
  return Math.max(90, Math.min(180, base));
}

function setStart(x, y) {
  startX = x;
  startY = y;
  moveX = x;
  moveY = y;
}

// Define the order of the pages
const pages = ["/dashboard", "/spotify", "/browser", "/timers", "/resources"];
let visiblePages = [];
let currentIndex = 0;

function syncNavigationPages() {
  const hiddenPages = JSON.parse(localStorage.getItem("hiddenPages") || "[]");
  visiblePages = pages.filter((page) => !hiddenPages.includes(page));

  if (visiblePages.length === 0) {
    visiblePages.push("/dashboard");
  }

  currentIndex = visiblePages.indexOf(window.location.pathname);
  if (currentIndex === -1) currentIndex = 0;
}

syncNavigationPages();

window.addEventListener("storage", (event) => {
  if (["hiddenPages", "defaultPage"].includes(event.key)) {
    syncNavigationPages();
  }
});

function canPrefetch() {
  const conn =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return !["slow-2g", "2g"].includes(conn.effectiveType);
}

function prefetchUrl(url) {
  if (!url || !canPrefetch()) return;

  const existing = document.querySelector(`link[rel="prefetch"][href="${url}"]`);
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "document";
  link.href = url;
  document.head.appendChild(link);
}

function prefetchNeighbors() {
  syncNavigationPages();

  if (visiblePages.length <= 1) {
    prefetchUrl("/settings");
    return;
  }

  const next = visiblePages[(currentIndex + 1) % visiblePages.length];
  const prev =
    visiblePages[(currentIndex - 1 + visiblePages.length) % visiblePages.length];
  prefetchUrl(next);
  prefetchUrl(prev);
  prefetchUrl("/settings");
  prefetchUrl(getDefaultPage());
}

function navigateTo(path) {
  setTimeout(() => {
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "pc-monitor:navigate", path },
        window.location.origin,
      );

      setTimeout(() => {
        document.body.classList.remove(
          "swipe-left",
          "swipe-right",
          "swipe-up",
          "swipe-down",
        );
      }, 50);
      return;
    }

    window.location.href = `/app#${path}`;
  }, NAVIGATION_DELAY_MS);
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("show");
  setTimeout(prefetchNeighbors, 350);
});

// Touch Events
document.addEventListener("touchstart", (event) => {
  ignoreSwipe = Boolean(event.target.closest("[data-no-swipe]"));
  if (event.touches.length !== 1) return;
  setStart(event.touches[0].clientX, event.touches[0].clientY);
});

document.addEventListener("touchmove", (event) => {
  if (ignoreSwipe) return;
  if (event.touches.length !== 1) return;
  moveX = event.touches[0].clientX;
  moveY = event.touches[0].clientY;

  let diffX = Math.abs(moveX - startX);
  let diffY = Math.abs(moveY - startY);

  // Check if swiping inside the playlist
  let isSwipingPlaylist = event.target.closest(".playlist-container");

  // If swiping inside playlist, allow vertical scrolling but prevent page navigation swipe
  if (isSwipingPlaylist && diffY > diffX) {
    return;
  }

  // If horizontal swipe detected and not inside the playlist, prevent default for page navigation
  if (!isSwipingPlaylist && diffX > diffY && Math.abs(diffX) > 10) {
    event.preventDefault();
  }
}, { passive: false });

document.addEventListener("touchend", (event) => {
  const last = event.changedTouches && event.changedTouches[0];
  if (last) {
    moveX = last.clientX;
    moveY = last.clientY;
  }
  handleSwipe();
});

// Mouse Events (for swiping with a mouse)
document.addEventListener("mousedown", (event) => {
  ignoreSwipe = Boolean(event.target.closest("[data-no-swipe]"));
  if (ignoreSwipe) return;
  isMouseDown = true;
  setStart(event.clientX, event.clientY);
});

document.addEventListener("mousemove", (event) => {
  if (!isMouseDown) return;
  moveX = event.clientX;
  moveY = event.clientY;
});

document.addEventListener("mouseup", () => {
  if (!isMouseDown) return;
  isMouseDown = false;
  handleSwipe();
});

// Swipe Handling
function handleSwipe() {
  // Let scrollable settings controls handle their own gestures.
  if (ignoreSwipe) return;
  const threshold = getSwipeThreshold();
  const diffX = moveX - startX;
  const diffY = moveY - startY;

  const absDiffX = Math.abs(diffX);
  const absDiffY = Math.abs(diffY);

  // Ignore taps (movement too small)
  if (absDiffX < threshold && absDiffY < threshold) return;

  // Horizontal swipe
  if (absDiffX > absDiffY && absDiffX > threshold) {
    if (diffX < 0) {
      navigateHorizontally("next"); // Swipe Left
    } else {
      navigateHorizontally("prev"); // Swipe Right
    }
  }

  // Vertical swipe
  else if (absDiffY > absDiffX && absDiffY > threshold) {
    const isSettingsPage = window.location.pathname.includes("/settings");

    if (diffY > 0 && !isSettingsPage) {
      // Swipe Down -> go to settings
      document.body.classList.add("swipe-down");
      navigateTo("/settings");
    } else if (diffY < 0 && isSettingsPage) {
      // Swipe Up -> go to default page
      document.body.classList.add("swipe-up");
      navigateTo(getDefaultPage());
    }
  }
}


// Swipe Transition + Fade-in Effect on New Page
function navigateHorizontally(direction) {
  syncNavigationPages();

  if (direction === "next") {
    document.body.classList.add("swipe-left");
    currentIndex = (currentIndex + 1) % visiblePages.length;
  } else {
    document.body.classList.add("swipe-right");
    currentIndex = (currentIndex - 1 + visiblePages.length) % visiblePages.length;
  }

  navigateTo(visiblePages[currentIndex]);
}

function getDefaultPage() {
  const hidden = JSON.parse(localStorage.getItem("hiddenPages")) || [];
  const candidate = localStorage.getItem("defaultPage") || "/dashboard";
  if (!hidden.includes(candidate)) {
    return candidate;
  }
  const fallbackOrder = ["/dashboard", "/spotify", "/timers", "/resources"];
  return fallbackOrder.find((p) => !hidden.includes(p)) || "/dashboard";
}
