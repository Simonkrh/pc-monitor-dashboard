const SERVER_IP = `http://${CONFIG.SERVER_PC_IP}/monitoring`;

let offlineCounter = 0;
let lastSuccessfulPing = Date.now();
let isChecking = false;

async function fetchWithTimeout(resource, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(id);
    }
}

async function checkPCStatus() {
    if (isChecking) return;
    isChecking = true;
    try {
        const statsRes = await fetchWithTimeout(`${SERVER_IP}/stats`, { method: "GET", cache: "no-store" }, 8000);

        if (statsRes.ok) {
            const data = await statsRes.json();

            if (data.error || data.cpu_usage === undefined || data.cpu_temp === undefined) {
                console.warn("[checkPCStatus] Stats incomplete or returned error:", data.error);
                throw new Error("Stats check failed");
            }

            offlineCounter = 0;
            lastSuccessfulPing = Date.now();
            return;
        } else {
            console.warn("[checkPCStatus] /stats responded with non-OK status");
            throw new Error("Non-OK /stats");
        }
    } catch (statsErr) {
        console.warn("[checkPCStatus] /stats failed, trying /ping...", statsErr);

        try {
            const pingRes = await fetchWithTimeout(`${SERVER_IP}/ping`, { method: "GET", cache: "no-store" }, 8000);

            if (pingRes.ok) {
                const data = await pingRes.json();
                if (data.status === "offline") {
                    offlineCounter++;
                    console.warn(`[checkPCStatus] /ping says offline. Offline count = ${offlineCounter}`);
                } else {
                    offlineCounter = 0;
                    lastSuccessfulPing = Date.now();
                    return;
                }
            } else {
                console.warn("[checkPCStatus] /ping responded with non-OK status");
                offlineCounter++;
            }
        } catch (pingErr) {
            console.error("[checkPCStatus] Error calling /ping:", pingErr);
            offlineCounter++;
        }
        
        const timeSinceLastSuccess = Date.now() - lastSuccessfulPing;
        if (offlineCounter >= 3 && timeSinceLastSuccess > 90000) {
            console.warn("[checkPCStatus] PC seems down. Redirecting to /.");
            window.location.href = "/";
        }
    } finally {
        isChecking = false;
    }
}

setInterval(checkPCStatus, 30000); 


function updateTimeAndDate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-GB", { hour12: false });
    const dateString = now.toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    document.getElementById("current-time").textContent = timeString;
    document.getElementById("current-date").textContent = dateString;
}

if (document.getElementById("current-time") || document.getElementById("current-date")) {
    setInterval(updateTimeAndDate, 1000);
}

document.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });

function applyTheme() {
    const root = document.documentElement;
    const stored = localStorage.getItem("themeVars");
    if (!stored) return;

    try {
        const vars = JSON.parse(stored);
        Object.entries(vars).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
    } catch (e) {
        console.warn("Failed to apply theme:", e);
    }
}

document.addEventListener("DOMContentLoaded", applyTheme);
  
