const backendServerIP = `${CONFIG.SERVER_PC_IP}`;
const configApiBase = `http://${backendServerIP}/config`;

let cachedConfig = null;

document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("backToSettings");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            window.location.href = "/settings";
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

    loadConfig();
}

function setConfigStatus(message, isError = false) {
    const status = document.getElementById("configStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", isError);
}

function fillConfigInputs(data) {
    const env = data?.env || {};
    const frontend = data?.frontend || {};

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? "";
    };

    setValue("cfg-frontend-server", frontend.SERVER_PC_IP ?? CONFIG.SERVER_PC_IP ?? "");
    setValue("cfg-frontend-macro", frontend.MACRO_PC_IP ?? CONFIG.MACRO_PC_IP ?? "");

    setValue("cfg-monitored-ip", env.MONITORED_PC_IP ?? "");
    setValue("cfg-monitored-mac", env.MONITORED_PC_MAC ?? "");
    setValue("cfg-monitored-disks", env.MONITORED_DISKS ?? "");
    setValue("cfg-spotify-client-id", env.SPOTIFY_CLIENT_ID ?? "");
    setValue("cfg-spotify-client-secret", env.SPOTIFY_CLIENT_SECRET ?? "");
    setValue("cfg-spotify-refresh-token", env.SPOTIFY_REFRESH_TOKEN ?? "");
    setValue("cfg-upload-folder", env.UPLOAD_FOLDER ?? "");
    setValue("cfg-backend-server-ip", env.SERVER_PC_IP ?? "");
}

async function loadConfig() {
    setConfigStatus("Loading...");
    try {
        const resp = await fetch(configApiBase, { cache: "no-store" });
        if (!resp.ok) {
            setConfigStatus(`Failed to load config (${resp.status})`, true);
            return;
        }

        const data = await resp.json();
        cachedConfig = data;
        fillConfigInputs(data);
        setConfigStatus("Loaded.");
    } catch (err) {
        console.error("Failed to load config:", err);
        setConfigStatus("Failed to load config.", true);
    }
}

function buildConfigPayload() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };

    return {
        frontend: {
            SERVER_PC_IP: getValue("cfg-frontend-server"),
            MACRO_PC_IP: getValue("cfg-frontend-macro")
        },
        env: {
            MONITORED_PC_IP: getValue("cfg-monitored-ip"),
            MONITORED_PC_MAC: getValue("cfg-monitored-mac"),
            MONITORED_DISKS: getValue("cfg-monitored-disks"),
            SPOTIFY_CLIENT_ID: getValue("cfg-spotify-client-id"),
            SPOTIFY_CLIENT_SECRET: getValue("cfg-spotify-client-secret"),
            SPOTIFY_REFRESH_TOKEN: getValue("cfg-spotify-refresh-token"),
            UPLOAD_FOLDER: getValue("cfg-upload-folder"),
            SERVER_PC_IP: getValue("cfg-backend-server-ip")
        }
    };
}

async function saveConfig() {
    const payload = buildConfigPayload();
    const previous = cachedConfig?.frontend || {};
    const frontendChanged =
        previous.SERVER_PC_IP !== payload.frontend.SERVER_PC_IP ||
        previous.MACRO_PC_IP !== payload.frontend.MACRO_PC_IP;

    setConfigStatus("Saving...");
    try {
        const resp = await fetch(configApiBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const msg = await resp.text();
            setConfigStatus(`Save failed: ${msg || resp.status}`, true);
            return;
        }

        const data = await resp.json();
        cachedConfig = data?.config || cachedConfig;
        if (cachedConfig) {
            fillConfigInputs(cachedConfig);
        }

        if (frontendChanged) {
            setConfigStatus("Saved. Refresh to use new server IPs.");
        } else {
            setConfigStatus("Saved.");
        }
    } catch (err) {
        console.error("Failed to save config:", err);
        setConfigStatus("Save failed.", true);
    }
}
