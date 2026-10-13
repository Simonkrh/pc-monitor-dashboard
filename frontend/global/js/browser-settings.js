(() => {
  let saving = false;
  let revision = 0;
  function cache(url) {
    const previous = localStorage.getItem("browserPageUrl") || "";
    if (url) localStorage.setItem("browserPageUrl", url);
    else localStorage.removeItem("browserPageUrl");
    if (previous !== url) window.dispatchEvent(new Event("browser-page-url-changed"));
  }
  async function request(options) {
    const response = await fetch("/api/browser-page", { cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load the shared browser setting.");
    if (typeof data.url !== "string") throw new Error("Invalid browser setting received.");
    return data;
  }
  async function load() {
    if (saving) return;
    const started = revision;
    const data = await request();
    // Keep legacy device settings until someone explicitly saves the shared
    // setting. An intentionally saved empty value still clears every client.
    const url = data.configured === false ? localStorage.getItem("browserPageUrl") || "" : data.url;
    if (!saving && started === revision) cache(url);
    return url;
  }
  async function save(url) {
    saving = true;
    revision++;
    try {
      const data = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      cache(data.url);
      return data.url;
    } finally {
      saving = false;
    }
  }
  function accept(url) {
    revision++;
    cache(url);
  }
  window.BrowserPageSettings = { load, save, accept };
  // Refresh mounted views without requiring a reload on other computers.
  setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 5000);
})();
