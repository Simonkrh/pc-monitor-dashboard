const SERVER_IP = `http://${CONFIG.SERVER_PC_IP}/monitoring`;

let offlineCounter = 0;

async function checkPCStatus() {
    try {
        const statsRes = await fetch(`${SERVER_IP}/stats`, { method: "GET", cache: "no-store" });

        if (statsRes.ok) {
            const data = await statsRes.json();

            if (data.error || data.cpu_usage === undefined || data.cpu_temp === undefined) {
                console.warn("[checkPCStatus] Stats incomplete or returned error:", data.error);
                throw new Error("Stats check failed");
            }

            offlineCounter = 0;
            return;
        } else {
            console.warn("[checkPCStatus] /stats responded with non-OK status");
            throw new Error("Non-OK /stats");
        }
    } catch (statsErr) {
        console.warn("[checkPCStatus] /stats failed, trying /ping...", statsErr);

        try {
            const pingRes = await fetch(`${SERVER_IP}/ping`, { method: "GET", cache: "no-store" });

            if (pingRes.ok) {
                const data = await pingRes.json();
                if (data.status === "offline") {
                    offlineCounter++;
                    console.warn(`[checkPCStatus] /ping says offline. Offline count = ${offlineCounter}`);
                } else {
                    offlineCounter = 0;
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

        // If 2+ failures in a row, redirect
        if (offlineCounter >= 2) {
            console.warn("[checkPCStatus] PC seems down. Redirecting to /.");
            window.location.href = "/";
        }
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
