const serverIP = `${CONFIG.SERVER_PC_IP}`;

async function sendMacro(command) {
    try {
        await fetch(`http://${serverIP}/${command}`, { method: 'POST' });
        console.log(`Sent command: ${command}`);
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