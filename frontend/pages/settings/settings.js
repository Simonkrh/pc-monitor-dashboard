const macroServerIP = `${CONFIG.MACRO_PC_IP}`;

const sessionButtons = new Map();

document.addEventListener("DOMContentLoaded", () => {
    const slideshowBtn = document.getElementById("slideshowButton");
    const uploadBtn = document.getElementById("uploadButton");
    
    slideshowBtn.addEventListener("click", () => {
        window.location.href = "/";
    });

    uploadBtn.addEventListener("click", () => {
        window.location.href = "/upload";
    });

    fetchAudioSessionsMetadata()
});

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

            if (hiddenSessions.includes(session.pid)) {
                button.classList.toggle('red-background');
            }

            button.onclick = () => {
                button.classList.toggle('red-background');
                toggleIdToLocalStorage(session.pid)
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