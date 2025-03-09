const SERVER_IP = `http://${CONFIG.SERVER_PC_IP}/monitoring`;  

async function checkPCStatus() {
    try {
        const response = await fetch(`${SERVER_IP}/ping`);
        if (!response.ok) {
            throw new Error("PC is offline");
        }
    } catch (error) {
        console.error("Monitored PC is offline. Redirecting...");
        window.location.href = "/";
    }
}
