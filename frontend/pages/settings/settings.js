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
    setupHiddenPagesButtons();
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

    const defaultPage = getDefaultPage();
    highlightSelected(defaultPage);

    buttons.dashboard.addEventListener("click", () => {
        setDefaultPage("/dashboard");
        highlightSelected(getDefaultPage());
    });

    buttons.spotify.addEventListener("click", () => {
        setDefaultPage("/spotify");
        highlightSelected(getDefaultPage());
    });

    buttons.resources.addEventListener("click", () => {
        setDefaultPage("/resources");
        highlightSelected(getDefaultPage());
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

function getHiddenPages() {
    return JSON.parse(localStorage.getItem("hiddenPages")) || [];
}

function getDefaultPage() {
    const hiddenPages = getHiddenPages();
    const candidate = localStorage.getItem("defaultPage") || "/dashboard";
    if (!hiddenPages.includes(candidate)) {
        return candidate;
    }
    const fallbackOrder = ["/dashboard", "/spotify", "/resources"];
    return fallbackOrder.find((p) => !hiddenPages.includes(p)) || "/dashboard";
}

function setDefaultPage(page) {
    const hiddenPages = getHiddenPages();
    if (hiddenPages.includes(page)) {
        return;
    }
    localStorage.setItem("defaultPage", page);
}

function setupHiddenPagesButtons() {
    const pageButtons = [
        { id: "toggleDashboardPage", path: "/dashboard", label: "Dashboard" },
        { id: "toggleSpotifyPage", path: "/spotify", label: "Spotify" },
        { id: "toggleResourcesPage", path: "/resources", label: "Resources" }
    ];

    const swipePages = ["/dashboard", "/spotify", "/resources"];
    const hiddenPages = getHiddenPages();

    const applyState = (btn, path, label, canHide) => {
        const isHidden = hiddenPages.includes(path);
        btn.classList.toggle("red-background", isHidden);
        btn.textContent = isHidden ? `${label} (Hidden)` : label;
        btn.disabled = !isHidden && !canHide;
    };

    const updateAllButtons = () => {
        const visibleSwipePages = swipePages.filter((p) => !hiddenPages.includes(p));
        const canHideAnyMore = visibleSwipePages.length > 1;

        pageButtons.forEach(({ id, path, label }) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const canHide = canHideAnyMore;
            applyState(btn, path, label, canHide);
        });

        const defaultPage = getDefaultPage();
        localStorage.setItem("defaultPage", defaultPage);
    };

    pageButtons.forEach(({ id, path, label }) => {
        const btn = document.getElementById(id);
        if (!btn) return;

        applyState(btn, path, label, true);

        btn.addEventListener("click", () => {
            const nextHidden = [...hiddenPages];
            const idx = nextHidden.indexOf(path);
            if (idx >= 0) {
                nextHidden.splice(idx, 1);
            } else {
                nextHidden.push(path);
            }

            const visibleSwipePages = swipePages.filter((p) => !nextHidden.includes(p));
            if (visibleSwipePages.length === 0) {
                return;
            }

            hiddenPages.length = 0;
            hiddenPages.push(...nextHidden);
            localStorage.setItem("hiddenPages", JSON.stringify(hiddenPages));
            updateAllButtons();
        });
    });

    updateAllButtons();
}
