const SERVER_IP = `http://${CONFIG.SERVER_PC_IP}/monitoring`;

async function checkPCStatus() {
    try {
        const response = await fetch(`${SERVER_IP}/ping`, { method: "GET", cache: "no-store" });

        if (response.ok) {
            const data = await response.json();
            if (data.status === "offline") {
                window.location.href = "/";
            }
        } else {
            console.warn("Received a non-OK response from /ping, but not redirecting.");
        }
    } catch (error) {
        console.error("Error checking PC status:", error);
    }
}

setInterval(checkPCStatus, 30000);
