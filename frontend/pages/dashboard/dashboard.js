const macroServerIP = `${CONFIG.MACRO_PC_IP}`;

let currentSessionName = null;
const sessionButtons = new Map();
let volumePollTimer = null;
let baseVolumePollTimer = null;
let volumeFetchInFlight = false;

const MACROS_CACHE_KEY = "macros_cache_v1";
const MACROS_CACHE_TTL_MS = 5 * 60 * 1000;

function readJsonCache(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

function writeJsonCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Ignore quota / private mode failures
  }
}

async function fetchMacros() {
  try {
    const cached = readJsonCache(MACROS_CACHE_KEY, MACROS_CACHE_TTL_MS);
    if (cached?.grid && Array.isArray(cached?.macros)) {
      renderMacroGrid(cached.grid, cached.macros);
    }

    const response = await fetch(`http://${macroServerIP}/macros`);
    const config = await response.json();

    renderMacroGrid(config.grid, config.macros);
    writeJsonCache(MACROS_CACHE_KEY, config);
  } catch (err) {
    console.error("Failed to fetch dashboard config:", err);
  }
}

function renderMacroGrid(grid, macros) {
  const container = document.getElementById('macro-grid-container');

  container.style.setProperty('--grid-columns', grid.columns);
  container.style.setProperty('--grid-rows', grid.rows);

  container.innerHTML = '';

  const totalSlots = grid.columns * grid.rows;
  const macroMap = {};
  macros.forEach(macro => {
    if (typeof macro.position === 'number') {
      macroMap[macro.position] = macro;
    }
  });

  for (let i = 0; i < totalSlots; i++) {
    const button = document.createElement('button');
    button.className = 'macro-btn';

    if (macroMap[i]) {
      const macro = macroMap[i];
      button.onclick = () => sendMacro(macro.macro);

      const img = document.createElement('img');
      img.src = `http://${macroServerIP}${macro.icon}`;
      img.className = 'macro-icon';
      img.onerror = () => { img.style.display = 'none'; };

      button.appendChild(img);
    } else {
      button.classList.add('empty-macro');
    }

    container.appendChild(button);
  }
}

async function postToServer(endpoint, payload) {
  const url = `http://${macroServerIP}/${endpoint}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error(`Error sending to ${endpoint}:`, error);
  }
}

async function sendMacro(command) {
  let endpoint = '';
  let payload = {};

  if (command.startsWith("open_app:")) {
    endpoint = 'open_app';

    const raw = command.slice("open_app:".length);
    const trimmed = raw.trimStart();

    if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj && typeof obj === "object" && typeof obj.app_path === "string") {
          payload = { app_path: obj.app_path };

          if (typeof obj.launch_params === "string" || Array.isArray(obj.launch_params)) {
            payload.launch_params = obj.launch_params;
          }
        } else {
          payload = { app_path: raw };
        }
      } catch {
        payload = { app_path: raw };
      }
    } else {
      payload = { app_path: raw };
    }

  } else if (command.startsWith("switch_account:")) {
    endpoint = 'switch_account';
    payload = { steam_id: command.slice("switch_account:".length) };

  } else if (command.startsWith("type_text:")) {
    endpoint = 'type_text';
    payload = { text: command.slice("type_text:".length) };

  } else {
    console.error("Unknown macro command:", command);
    return;
  }

  await postToServer(endpoint, payload);
}

/* Volume UI helpers */
function updateSlider(volume) {
  const slider = document.getElementById('volume-slider');
  slider.value = volume;
  slider.style.setProperty('--volume-fill', `${volume}%`);
}

function updateSessionIcon(src) {
  const icon = document.getElementById('volume-session-icon');
  icon.src = src;
  icon.style.transform = 'scaleY(-1)'; // Because they are originally upside down
}

/* Fetch and render audio sessions */
async function fetchAudioSessionsMetadata() {
  const container = document.getElementById('audio-session-controls');
  const sliderView = document.getElementById('volume-slider-view');
  const seenSessions = new Set();

  let sessions = [];

  try {
    const response = await fetch(`http://${macroServerIP}/audio_sessions_metadata`);
    sessions = await response.json();
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return;
  }

  sessions.forEach(session => {
    seenSessions.add(session.name);

    if (!sessionButtons.has(session.name) && !isSessionHidden(session.name)) {
      const button = document.createElement('button');
      button.className = 'macro-btn';

      const img = document.createElement('img');
      img.src = `data:image/png;base64,${session.icon}`;
      img.className = 'macro-icon';
      img.alt = session.name;
      img.title = session.name;
      img.style.transform = 'scaleY(-1)';
      button.appendChild(img);
      container.appendChild(button);

      button.onclick = async () => {
        currentSessionName = session.name;

        await fetchAudioSessionVolumes();

        updateSlider(sessionButtons.get(session.name)?.volume ?? session.volume);
        updateSessionIcon(img.src);

        startFastPolling();

        container.classList.add('d-none');
        document.getElementById('volume-slider-view').classList.remove('d-none');
      };

      sessionButtons.set(session.name, { button, img, volume: session.volume });
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

  if (currentSessionName) {
    const entry = sessionButtons.get(currentSessionName);
    if (entry) {
      updateSlider(entry.volume);
    } else {
      returnToIcons();
    }
  } else {
    sliderView.classList.add('d-none');
    container.classList.remove('d-none');
  }
}

function isSessionHidden(id) {
  let isSessionHidden = false;
  const ids = JSON.parse(localStorage.getItem('hiddenSessionIds'));
  
  if (ids != null && ids.includes(id)) {
    isSessionHidden = true;
  }
  
  return isSessionHidden;
}

async function fetchAudioSessionVolumes() {
  if (document.hidden) return;
  if (volumeFetchInFlight) return;
  volumeFetchInFlight = true;

  try {
    const response = await fetch(`http://${macroServerIP}/audio_sessions_volume`);
    if (!response.ok) throw new Error(`macro-server responded ${response.status}`);
    const volumes = await response.json();

    let shouldFetchMetadata = false;

    volumes.forEach(session => {
      if (sessionButtons.has(session.name)) {
        const entry = sessionButtons.get(session.name);
        entry.volume = session.volume;

        if (currentSessionName === session.name) {
          updateSlider(session.volume);
        }
      } else {
        shouldFetchMetadata = true;
      }
    });

    // If current session no longer exists, return to icon view
    if (currentSessionName && !volumes.some(s => s.name === currentSessionName)) {
      returnToIcons();
    }

    if (shouldFetchMetadata) {
      fetchAudioSessionsMetadata();
    }
  } catch (err) {
    console.error("Failed to fetch audio session volumes:", err);
  } finally {
    volumeFetchInFlight = false;
  }
}

document.getElementById('volume-slider').addEventListener('input', function () {
  if (!currentSessionName) return;
  const volume = this.value;

  updateSlider(volume);
  postToServer('set_app_volume', { app_name: currentSessionName, volume });
});

function startFastPolling() {
  stopFastPolling();
  volumePollTimer = setInterval(fetchAudioSessionVolumes, 400);
}

function stopFastPolling() {
  if (volumePollTimer) clearInterval(volumePollTimer);
  volumePollTimer = null;
}

function startBasePolling() {
  stopBasePolling();
  baseVolumePollTimer = setInterval(() => {
    if (!currentSessionName) fetchAudioSessionVolumes();
  }, 5000);
}

function stopBasePolling() {
  if (baseVolumePollTimer) clearInterval(baseVolumePollTimer);
  baseVolumePollTimer = null;
}

function returnToIcons() {
  stopFastPolling();
  currentSessionName = null;
  document.getElementById('volume-slider-view').classList.add('d-none');
  document.getElementById('audio-session-controls').classList.remove('d-none');
}

deviceReady = async () => {
  await fetchMacros();
  await fetchAudioSessionsMetadata();
  await fetchAudioSessionVolumes();
  startBasePolling();
};

window.addEventListener('DOMContentLoaded', deviceReady);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopFastPolling();
    stopBasePolling();
    return;
  }

  if (currentSessionName) startFastPolling();
  startBasePolling();
  fetchAudioSessionVolumes();
});
 
