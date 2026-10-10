const websiteFrame = document.getElementById("websiteFrame");
const emptyBrowser = document.getElementById("emptyBrowser");

function updateClock() {
  const now = new Date();
  document.getElementById("current-time").textContent = now.toLocaleTimeString(
    "en-GB",
    { hour12: false },
  );
  document.getElementById("current-date").textContent = now.toLocaleDateString(
    "en-GB",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  );
}

function navigate(path) {
  if (window.parent !== window) {
    window.parent.postMessage(
      { type: "pc-monitor:navigate", path },
      window.location.origin,
    );
    return;
  }
  window.location.href = `/app#${path}`;
}

function goBackOnWebsite() {
  const desktop = window.parent.pcMonitorDesktop;
  if (desktop?.isElectron) {
    desktop.goBackBrowserPage();
    return;
  }

  try {
    websiteFrame.contentWindow.history.back();
  } catch {
    // Browsers may block history access for websites from another origin.
  }
}

function updateWebsite() {
  let url = localStorage.getItem("browserPageUrl") || "";
  const isElectron = Boolean(window.parent.pcMonitorDesktop?.isElectron);

  try {
    if (url) new URL(url);
  } catch {
    url = "";
  }
  emptyBrowser.hidden = Boolean(url);

  if (!isElectron && url && websiteFrame.src !== url) {
    websiteFrame.src = url;
  } else if (!url) {
    websiteFrame.removeAttribute("src");
  }
}

document.getElementById("previousPage").addEventListener("click", () => navigate("/spotify"));
document.getElementById("websiteBack").addEventListener("click", goBackOnWebsite);
document.getElementById("nextPage").addEventListener("click", () => navigate("/timers"));
window.addEventListener("storage", (event) => {
  if (event.key === "browserPageUrl") updateWebsite();
});

updateWebsite();
updateClock();
setInterval(updateClock, 1000);
