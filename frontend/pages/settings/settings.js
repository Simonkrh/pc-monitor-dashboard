const macroServerIP = `${CONFIG.MACRO_PC_IP}`;

const outputButtons  = new Map();
const sessionButtons = new Map();

document.addEventListener("DOMContentLoaded", () => {
    const slideshowBtn = document.getElementById("slideshowButton");
    const uploadBtn = document.getElementById("uploadButton");
    const manageMacrosBtn = document.getElementById("manageMacrosButton");
    
    
    slideshowBtn.addEventListener("click", () => {
        window.location.href = "/";
    });

    uploadBtn.addEventListener("click", () => {
        window.location.href = "/upload";
    });

    manageMacrosBtn.addEventListener("click", () => {
        window.location.href = "/manageMacros";
    });

    fetchAudioOutputs();
    fetchAudioSessionsMetadata()
    setupDefaultPageButtons();
});

async function fetchAudioOutputs() {
    const container = document.getElementById('audio-output-controls');
    container.innerHTML = '';

    try {
        const resp = await fetch(`http://${macroServerIP}/audio_output_devices`);
        if (!resp.ok) {
            console.error('macro-server replied', resp.status, resp.statusText);
            return;
        }

        const outputs = await resp.json();

        outputs.forEach(dev => {
            const btn = document.createElement('button');
            btn.textContent = dev.name;

            btn.classList.toggle('btn-default-selected', dev.is_default);

            btn.onclick = () => setDefaultOutput(dev.id);
            container.appendChild(btn);
        });

    } catch (err) {
        console.error('could not reach macro-server', err);
    }
}

async function setDefaultOutput(deviceId) {
    try {
        const res = await fetch(`http://${macroServerIP}/set_audio_output_device`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ device_id: deviceId })
        });

        if (!res.ok) {
            console.error('macro-server error', res.status, await res.text());
            return;
        }
        
        fetchAudioOutputs();

    } catch (err) {
        console.error('network/JSON error while setting output', err);
    }
}

async function fetchAudioSessionsMetadata() {
    const container = document.getElementById('audio-session-controls');
    const seenSessions = new Set();
    const hiddenSessions = JSON.parse(localStorage.getItem('hiddenSessionIds')) || [];

    let sessions = [];
    try {
        const response = await fetch(`http://${macroServerIP}/audio_sessions_metadata`);
        sessions = await response.json();
    } catch (error) {
        console.error("Failed to fetch audio sessions:", error);
        return;
    }

    sessions.forEach(session => {
        seenSessions.add(session.pid);
        
        if (!sessionButtons.has(session.pid)) {
            const button = document.createElement('button');
            button.className = 'macro-btn';

            const img = document.createElement('img');
            img.src = `data:image/png;base64,${session.icon}`;
            img.className = 'macro-icon';
            img.alt = session.name;
            img.title = session.name;
            img.style.transform = 'scaleY(-1)';
            button.appendChild(img);
            
            const buttonLabel = document.createElement('label');
            buttonLabel.textContent = session.name;
            
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';

            wrapper.appendChild(button);
            wrapper.appendChild(buttonLabel);

            container.appendChild(wrapper);

            if (hiddenSessions.includes(session.name)) {
                button.classList.toggle('red-background');
            }

            button.onclick = () => {
                console.log(session)
                button.classList.toggle('red-background');
                toggleIdToLocalStorage(session.name)
            };


            sessionButtons.set(session.pid,  { button, img, volume: 0 });
        }
    });

    // Remove buttons for sessions that no longer exist
    for (const name of sessionButtons.keys()) {
        if (!seenSessions.has(name)) {
            const { button } = sessionButtons.get(name);
            container.removeChild(button);
            sessionButtons.delete(name);
        }
    }
}

function toggleIdToLocalStorage(id) {
    const existing = JSON.parse(localStorage.getItem('hiddenSessionIds')) || [];
    let updated;

    if (existing.includes(id)) {
        updated = existing.filter(item => item !== id);
    } else {
        updated = [...existing, id];
    }

    localStorage.setItem('hiddenSessionIds', JSON.stringify(updated));
}

function setupDefaultPageButtons() {
    const buttons = {
        dashboard: document.getElementById("defaultDashboard"),
        spotify: document.getElementById("defaultSpotify"),
        resources: document.getElementById("defaultResources")
    };

    const defaultPage = localStorage.getItem("defaultPage") || "/dashboard";
    highlightSelected(defaultPage);

    buttons.dashboard.addEventListener("click", () => {
        localStorage.setItem("defaultPage", "/dashboard");
        highlightSelected("/dashboard");
    });

    buttons.spotify.addEventListener("click", () => {
        localStorage.setItem("defaultPage", "/spotify");
        highlightSelected("/spotify");
    });

    buttons.resources.addEventListener("click", () => {
        localStorage.setItem("defaultPage", "/resources");
        highlightSelected("/resources");
    });

    function highlightSelected(selected) {
    Object.entries(buttons).forEach(([key, btn]) => {
        btn.classList.remove("btn-default-selected");
        if (`/${key}` === selected) {
            btn.classList.add("btn-default-selected");
        }
    });
}

}
