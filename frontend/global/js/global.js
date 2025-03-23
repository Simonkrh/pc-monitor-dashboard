const serverIP = `${CONFIG.SERVER_PC_IP}:${CONFIG.SERVER_PORT || 5000}/monitoring`;

async function checkPCStatus() {
    console.log("Pinging")
    try {
        const response = await fetch(`${serverIP}/ping`, { method: "GET", cache: "no-store" });

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

setInterval(checkPCStatus, 5000);
