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
    if (document.hidden) return;
    isChecking = true;
    try {
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
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkPCStatus();
});


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
document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("show");
    checkPCStatus();
});

(function setupTimerAlertMonitor() {
    const timerStorageKey = "timerToolsTimers";
    let overlay;
    let edge;

    document.addEventListener("DOMContentLoaded", () => {
        ensureTimerAlertElements();
        updateTimerAlertState();
        setInterval(updateTimerAlertState, 750);
    });

    function ensureTimerAlertElements() {
        if (!edge) {
            edge = document.createElement("div");
            edge.className = "timer-alert-screen-edge";
            edge.setAttribute("aria-hidden", "true");
            document.body.appendChild(edge);
        }

        if (!overlay) {
            overlay = document.createElement("div");
            overlay.className = "timer-alert-overlay";
            overlay.setAttribute("role", "alert");
            overlay.setAttribute("aria-live", "assertive");
            overlay.innerHTML = `
                <div class="timer-alert-panel">
                    <div>
                        <div class="timer-alert-title" id="timer-alert-title">Timer done</div>
                        <div class="timer-alert-detail" id="timer-alert-detail">A timer finished.</div>
                    </div>
                    <div class="timer-alert-actions">
                        <button type="button" data-timer-alert-action="open">Open</button>
                        <button class="timer-alert-primary" type="button" data-timer-alert-action="dismiss">Dismiss</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            overlay.querySelectorAll("[data-timer-alert-action]").forEach((button) => {
                button.addEventListener("click", () => {
                    handleTimerAlertAction(button.dataset.timerAlertAction);
                });
            });
        }
    }

    function readTimers() {
        try {
            const timers = JSON.parse(localStorage.getItem(timerStorageKey) || "[]");
            return Array.isArray(timers) ? timers : [];
        } catch (error) {
            console.warn("Failed to read timers:", error);
            return [];
        }
    }

    function writeTimers(timers) {
        localStorage.setItem(timerStorageKey, JSON.stringify(timers));
        window.dispatchEvent(new CustomEvent("timerToolsUpdated"));
    }

    function updateTimerAlertState() {
        if (!document.body) return;
        ensureTimerAlertElements();

        const timers = readTimers();
        const now = Date.now();
        let changed = false;

        timers.forEach((timer) => {
            if (!timer.isRunning || !timer.endsAt) return;
            const remainingMs = Math.max(0, timer.endsAt - now);
            if (remainingMs <= 0) {
                timer.remainingMs = 0;
                timer.isRunning = false;
                timer.endsAt = null;
                timer.completed = true;
                changed = true;
            }
        });

        if (changed) {
            writeTimers(timers);
        }

        const completedTimers = timers.filter((timer) => timer.completed);
        const isActive = completedTimers.length > 0;
        document.body.classList.toggle("timer-alert-active", isActive);
        overlay.classList.toggle("is-active", isActive);

        if (!isActive) return;

        const title = completedTimers.length === 1
            ? "Timer done"
            : `${completedTimers.length} timers done`;
        const detail = completedTimers.length === 1
            ? "Your timer finished."
            : "Multiple timers finished.";

        const titleEl = overlay.querySelector("#timer-alert-title");
        const detailEl = overlay.querySelector("#timer-alert-detail");
        if (titleEl) titleEl.textContent = title;
        if (detailEl) detailEl.textContent = detail || "A timer finished.";
    }

    function handleTimerAlertAction(action) {
        if (action === "open") {
            window.location.href = "/timers";
            return;
        }

        const timers = readTimers();

        timers.forEach((timer) => {
            if (!timer.completed) return;

            if (action === "dismiss") {
                timer.isRunning = false;
                timer.endsAt = null;
                timer.remainingMs = 0;
                timer.completed = false;
            }
        });

        writeTimers(timers);
        updateTimerAlertState();
    }
})();
  
