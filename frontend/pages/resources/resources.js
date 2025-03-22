const serverIP = CONFIG.SERVER_PC_IP;
const socket = io(`http://${serverIP}`); 

socket.on("update_stats", (data) => {
    // CPU
    document.getElementById("cpu_temp").innerText = `CPU Temp: ${data.cpu_temp || "N/A"}°`;
    document.getElementById("cpu_power").innerText = `CPU Power: ${data.cpu_power || "N/A"}`;
    document.getElementById("cpu-gauge-text").textContent = Math.round(data.cpu_usage);
    document.getElementById("cpu-gauge").style.setProperty("--value", `${(data.cpu_usage / 100) * 360}deg`);

    // GPU
    document.getElementById("gpu_temp").innerText = `GPU Temp: ${data.gpu_temp || "N/A"}°`;
    document.getElementById("gpu_power").innerText = `GPU Power: ${data.gpu_power || "N/A"}`;
    document.getElementById("gpu-gauge-text").textContent = Math.round(data.gpu_usage);
    document.getElementById("gpu-gauge").style.setProperty("--value", `${(data.gpu_usage / 100) * 360}deg`);

    // RAM
    const totalRamGB = 32;
    const usedRamGB = parseFloat(data.ram_usage_gb) || 0;
    const ramPercent = (usedRamGB / totalRamGB) * 100;
    document.getElementById("ram-gauge").style.setProperty("--value", `${(ramPercent / 100) * 360}deg`);
    document.getElementById("ram-gauge-text").textContent = Math.round(ramPercent);

    // Disks
    function updateDiskBar(diskId, value) {
        const diskElement = document.getElementById(diskId);
        if (diskElement) {
            const percent = parseFloat(value) || 0;
            diskElement.style.width = percent + "%";
            diskElement.textContent = percent.toFixed(1) + "%";
        }
    }

    updateDiskBar("disk-c-bar", data.disk_c_usage);
    updateDiskBar("disk-f-bar", data.disk_f_usage);
    updateDiskBar("disk-d-bar", data.disk_d_usage);

    // Network Speed Conversion (Auto-switch between KB/s & Mbps)
    function formatSpeed(speedKBs) {
        const speedMbps = (speedKBs * 8) / 1024; // Convert KB/s to Mbps
        return speedMbps >= 1
            ? `${speedMbps.toFixed(1)} Mbps`
            : `${speedKBs.toFixed(1)} KB/s`;
    }

    const downloadSpeedKBs = (parseFloat(data.network_download) || 0) / 1024;
    const uploadSpeedKBs = (parseFloat(data.network_upload) || 0) / 1024;

    document.getElementById("network-download").textContent = formatSpeed(downloadSpeedKBs);
    document.getElementById("network-upload").textContent = formatSpeed(uploadSpeedKBs);
});

socket.on("connect_error", (error) => {
    console.error("WebSocket connection error:", error);
});

socket.on("disconnect", () => {
    console.warn("WebSocket disconnected. Attempting to reconnect...");
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
setInterval(updateTimeAndDate, 1000);
updateTimeAndDate();
