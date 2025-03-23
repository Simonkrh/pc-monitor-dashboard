const serverIP = `${CONFIG.MACRO_PC_IP}`;

async function sendMacro(command) {
    let url = "";
    let payload = {};

    if (command.startsWith("open_app:")) {
        url = `http://${serverIP}/open_app`;
        payload = { app_path: command.replace("open_app:", "") };
    } else if (command.startsWith("switch_account:")) {
        url = `http://${serverIP}/switch_account`;
        payload = { steam_id: command.replace("switch_account:", "") };
    } else {
        console.error("Unknown macro command:", command);
        return;
    }

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(`Sent command to ${url}`, payload);
    } catch (error) {
        console.error("Error sending macro:", error);
    }
}

// Show volume slider, hide icons
function showVolumeSlider() {
    document.getElementById('volume-icons').classList.add('d-none');
    document.getElementById('volume-slider').classList.remove('d-none');
}

// Hide volume slider, show icons
function hideVolumeSlider() {
    document.getElementById('volume-icons').classList.remove('d-none');
    document.getElementById('volume-slider').classList.add('d-none');
}