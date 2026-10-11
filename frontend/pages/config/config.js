let cachedConfig = null;

document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("backToSettings");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            window.location.href = "/app#/settings";
        });
    }

    setupConfigUi();
});

function setupConfigUi() {
    const reloadBtn = document.getElementById("configReload");
    const saveBtn = document.getElementById("configSave");
    const showSpotify = document.getElementById("cfg-spotify-show");

    if (!reloadBtn || !saveBtn) {
        return;
    }

    reloadBtn.addEventListener("click", loadConfig);
    saveBtn.addEventListener("click", saveConfig);

    if (showSpotify) {
        showSpotify.addEventListener("change", () => {
            const type = showSpotify.checked ? "text" : "password";
            ["cfg-spotify-client-id", "cfg-spotify-client-secret", "cfg-spotify-refresh-token"].forEach((id) => {
                const input = document.getElementById(id);
                if (input) input.type = type;
            });
        });
    }

    setupBrowserToken();
    loadConfig();
}

function setupBrowserToken() {
    const input = document.getElementById("cfg-browser-token");
    const show = document.getElementById("cfg-browser-show");
    show.addEventListener("change", () => {
        input.type = show.checked ? "text" : "password";
    });
    document.getElementById("cfg-browser-generate").addEventListener("click", () => {
        if (!cachedConfig) return;
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        input.value = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
        setConfigStatus("Token generated. Click Save to enable it, then copy it to your extension.");
    });
    document.getElementById("cfg-browser-copy").addEventListener("click", async () => {
        if (!cachedConfig) return;
        if (!input.value.trim()) {
            setConfigStatus("Generate a pairing token first.", true);
            return;
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(input.value.trim());
            } else {
                // Clipboard API requires a secure context; LAN HTTP pages use
                // the user-triggered selection fallback instead.
                const originalType = input.type;
                try {
                    input.type = "text";
                    input.focus();
                    input.select();
                    if (!document.execCommand("copy")) throw new Error("Copy unavailable");
                } finally {
                    input.type = originalType;
                }
            }
            const saved = input.value.trim() === (cachedConfig.env.BROWSER_SEND_TOKEN || "");
            setConfigStatus(saved ? "Token copied. Paste it into your extension's settings."
                : "Token copied. Click Save before using it in your extension.");
        } catch {
            show.checked = true;
            input.type = "text";
            input.focus();
            input.select();
            setConfigStatus("Automatic copy is unavailable. Copy the selected token manually.", true);
        }
    });
}

function setConfigStatus(message, isError = false) {
    const status = document.getElementById("configStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", isError);
}

function fillConfigInputs(data) {
    const env = data?.env || {};

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? "";
    };

    setValue("cfg-frontend-server", env.SERVER_PC_IP ?? "");
    setValue("cfg-frontend-macro", env.MACRO_PC_IP ?? "");
    setValue("cfg-browser-token", env.BROWSER_SEND_TOKEN ?? "");

    setValue("cfg-monitored-ip", env.MONITORED_PC_IP ?? "");
    setValue("cfg-ohm-port", env.OHM_PORT || "8085");
    setValue("cfg-monitored-mac", env.MONITORED_PC_MAC ?? "");
    setValue("cfg-monitored-disks", env.MONITORED_DISKS ?? "");
    setValue("cfg-spotify-client-id", env.SPOTIFY_CLIENT_ID ?? "");
    setValue("cfg-spotify-client-secret", env.SPOTIFY_CLIENT_SECRET ?? "");
    setValue("cfg-spotify-refresh-token", env.SPOTIFY_REFRESH_TOKEN ?? "");
    setValue("cfg-upload-folder", env.UPLOAD_FOLDER ?? "");
}

function setSaveEnabled(enabled) {
    document.getElementById("configSave").disabled = !enabled;
    document.getElementById("cfg-browser-generate").disabled = !enabled;
    document.getElementById("cfg-browser-copy").disabled = !enabled;
}

async function requestConfig(options = {}) {
    const response = await fetch("/api/config", { cache: "no-store", ...options });
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error(`The config service returned an unexpected response (HTTP ${response.status}). Restart the frontend and backend, then reload.`);
    }
    if (!response.ok) throw new Error(data.error || `Backend returned HTTP ${response.status}.`);
    return data;
}

async function loadConfig() {
    cachedConfig = null;
    setSaveEnabled(false);
    document.getElementById("configReload").disabled = true;
    setConfigStatus("Loading...");
    try {
        const data = await requestConfig();
        if (!data || !data.env || typeof data.env !== "object" || Array.isArray(data.env)) {
            throw new Error("The backend returned an invalid configuration.");
        }
        fillConfigInputs(data);
        cachedConfig = data;
        setSaveEnabled(true);
        setConfigStatus("Loaded.");
    } catch (err) {
        setConfigStatus(`Failed to load config. ${err.message} Your saved settings have not been changed.`, true);
    } finally {
        document.getElementById("configReload").disabled = false;
    }
}

function buildConfigPayload() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };

    return {
        env: {
            MONITORED_PC_IP: getValue("cfg-monitored-ip"),
            OHM_PORT: getValue("cfg-ohm-port") || "8085",
            MONITORED_PC_MAC: getValue("cfg-monitored-mac"),
            MONITORED_DISKS: getValue("cfg-monitored-disks"),
            SPOTIFY_CLIENT_ID: getValue("cfg-spotify-client-id"),
            SPOTIFY_CLIENT_SECRET: getValue("cfg-spotify-client-secret"),
            SPOTIFY_REFRESH_TOKEN: getValue("cfg-spotify-refresh-token"),
            UPLOAD_FOLDER: getValue("cfg-upload-folder"),
            SERVER_PC_IP: getValue("cfg-frontend-server"),
            MACRO_PC_IP: getValue("cfg-frontend-macro"),
            BROWSER_SEND_TOKEN: getValue("cfg-browser-token")
        }
    };
}

async function saveConfig() {
    if (!cachedConfig) return;
    const payload = buildConfigPayload();
    setSaveEnabled(false);
    document.getElementById("configReload").disabled = true;
    setConfigStatus("Saving...");
    try {
        const data = await requestConfig({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!data.config?.env) throw new Error("The backend did not confirm the saved configuration. Reload to check its current values.");
        cachedConfig = data.config;
        fillConfigInputs(cachedConfig);
        setConfigStatus("Saved. Refresh the dashboard to use new server addresses.");
    } catch (err) {
        setConfigStatus(`Save failed. ${err.message}`, true);
    } finally {
        setSaveEnabled(Boolean(cachedConfig));
        document.getElementById("configReload").disabled = false;
    }
}
