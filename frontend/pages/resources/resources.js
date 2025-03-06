const serverIP = CONFIG.SERVER_PC_IP;
async function fetchData() {
    const startTime = Date.now();

    try {
        const response = await fetch(`http://${serverIP}:5000/api/stats`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // CPU
        const cpuUsage = parseFloat(data.cpu_usage) || 0;
        const cpuDegrees = (cpuUsage / 100) * 360;
        document.getElementById("cpu-gauge").style.setProperty("--value", cpuDegrees + "deg");
        document.getElementById("cpu-gauge-text").textContent = Math.round(cpuUsage);
        document.getElementById("cpu_temp").innerText = `CPU Temp: ${data.cpu_temp || "N/A"}°`;
        document.getElementById("cpu_power").innerText = `CPU Power: ${data.cpu_power || "N/A"}`;

        // GPU
        const gpuUsage = parseFloat(data.gpu_usage) || 0;
        const gpuDegrees = (gpuUsage / 100) * 360;
        document.getElementById("gpu-gauge").style.setProperty("--value", gpuDegrees + "deg");
        document.getElementById("gpu-gauge-text").textContent = Math.round(gpuUsage);
        document.getElementById("gpu_temp").innerText = `GPU Temp: ${data.gpu_temp || "N/A"}°`;
        document.getElementById("gpu_power").innerText = `GPU Power: ${data.gpu_power || "N/A"}`;

        // RAM
        const totalRamGB = 32;
        const usedRamGB = parseFloat(data.ram_usage_gb) || 0;
        const ramPercent = (usedRamGB / totalRamGB) * 100;
        const ramDegrees = (ramPercent / 100) * 360;
        document.getElementById("ram-gauge").style.setProperty("--value", ramDegrees + "deg");
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

    } catch (error) {
        console.error("Error fetching system data:", error);
    }

    // Ensure the next update always gets scheduled
    const elapsedTime = Date.now() - startTime;
    const nextUpdateIn = Math.max(1000 - elapsedTime, 1000);
    setTimeout(fetchData, nextUpdateIn);
}

// Restart fetching when tab is active
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fetchData();
});

fetchData();


function updateTimeAndDate() {
    const now = new Date();

    // Format time as HH:MM:SS
    const timeString = now.toLocaleTimeString("en-GB", { hour12: false });

    // Format date as YYYY-MM-DD
    const dateString = now.toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    // Update elements
    document.getElementById("current-time").textContent = timeString;
    document.getElementById("current-date").textContent = dateString;
}
setInterval(updateTimeAndDate, 1000);
updateTimeAndDate();

