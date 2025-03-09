async function checkPCStatus() {
    try {
        const response = await fetch("/ping", { method: "GET", cache: "no-store" });
        if (!response.ok) {
            throw new Error("PC is offline");
        }
    } catch (error) {
        console.error("Monitored PC is offline. Redirecting...");
        window.location.href = "/";
    }
}

setInterval(checkPCStatus, 10000);
