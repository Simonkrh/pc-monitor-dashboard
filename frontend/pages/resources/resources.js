const serverIP = `${CONFIG.SERVER_PC_IP}`;
const socket = io(`http://${serverIP}`, {
    reconnection: true,
    reconnectionAttempts: 9999,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

const statusEl = document.getElementById("ohm-status");
const startTime = Date.now();
let lastUpdateAt = 0;
const STALE_AFTER_MS = 5000;

function setStatus(text, level) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.remove("status-hidden", "status-warn", "status-error");

    if (!text) {
        statusEl.classList.add("status-hidden");
        return;
    }

    if (level === "error") {
        statusEl.classList.add("status-error");
    } else {
        statusEl.classList.add("status-warn");
    }
}

setStatus("Waiting for Open Hardware Monitor...", "warn");

// Disks
function renderDisks(disks) {
    const container = document.getElementById("disk-stats");
    if (!container) return;

    container.innerHTML = "";

    if (!disks || Object.keys(disks).length === 0) {
        container.innerHTML = "<p>No disks configured</p>";
        return;
    }

    for (const [name, value] of Object.entries(disks)) {
        const percent = Math.max(0, Math.min(100, Number(value) || 0));

        const label = document.createElement("p");
        label.textContent = name;

        const progress = document.createElement("div");
        progress.className = "progress";

        const bar = document.createElement("div");
        bar.className = "progress-bar";
        bar.style.width = `${percent}%`;
        bar.textContent = `${percent.toFixed(1)}%`;

        progress.appendChild(bar);
        container.appendChild(label);
        container.appendChild(progress);
    }
}

socket.on("update_stats", (data) => {
    lastUpdateAt = Date.now();
    setStatus("", "warn");

    // CPU
    document.getElementById("cpu_temp").innerText = `CPU Temp: ${data.cpu_temp || "N/A"}°`;
    document.getElementById("cpu_power").innerText = `CPU Power: ${data.cpu_power || "N/A"}W`;
    document.getElementById("cpu-gauge-text").textContent = Math.round(data.cpu_usage);
    document.getElementById("cpu-gauge").style.setProperty("--value", `${(data.cpu_usage / 100) * 360}deg`);

    // GPU
    document.getElementById("gpu_temp").innerText = `GPU Temp: ${data.gpu_temp || "N/A"}°`;
    document.getElementById("gpu_power").innerText = `GPU Power: ${data.gpu_power || "N/A"}W`;
    document.getElementById("gpu-gauge-text").textContent = Math.round(data.gpu_usage);
    document.getElementById("gpu-gauge").style.setProperty("--value", `${(data.gpu_usage / 100) * 360}deg`);

    // RAM
    const totalRamGB = 32;
    const usedRamGB = parseFloat(data.ram_usage_gb) || 0;
    const ramPercent = (usedRamGB / totalRamGB) * 100;
    document.getElementById("ram-gauge").style.setProperty("--value", `${(ramPercent / 100) * 360}deg`);
    document.getElementById("ram-gauge-text").textContent = Math.round(ramPercent);

    renderDisks(data.disks);
});

socket.on("connect_error", (error) => {
    console.error("WebSocket connection error:", error);
    setStatus("Cannot connect to the monitor server.", "error");
});

socket.on("disconnect", () => {
    console.warn("WebSocket disconnected. Attempting to reconnect...");
    setStatus("Disconnected from monitor server. Reconnecting...", "error");
});

setInterval(() => {
    const now = Date.now();
    if (!lastUpdateAt) {
        if (now - startTime > STALE_AFTER_MS) {
            setStatus("Open Hardware Monitor not responding. Is it running on the PC?", "error");
        }
        return;
    }
    if (now - lastUpdateAt > STALE_AFTER_MS) {
        setStatus("Open Hardware Monitor not responding. Is it running on the PC?", "error");
    }
}, 1000);
