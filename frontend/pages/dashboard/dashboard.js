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


// Volume
let currentSessionName = null;
const sessionButtons = new Map();

async function fetchAudioSessions() {
  const container = document.getElementById('audio-session-controls');
  const sliderView = document.getElementById('volume-slider-view');

  const response = await fetch(`http://${serverIP}/audio_sessions`);
  const sessions = await response.json();

  const seenSessions = new Set();

  sessions.forEach(session => {
    seenSessions.add(session.name);

    if (!sessionButtons.has(session.name)) {
      // Create button if not exists
      const button = document.createElement('button');
      button.className = 'macro-btn';

      const img = document.createElement('img');
      img.src = `data:image/png;base64,${session.icon}`;
      img.className = 'macro-icon';
      img.alt = session.name;
      img.title = session.name;
      img.style.transform = 'scaleY(-1)'; // Because they are originally upside down

      button.appendChild(img);
      container.appendChild(button);

      button.onclick = () => {
        currentSessionName = session.name;

        const slider = document.getElementById('volume-slider');
        slider.value = session.volume;
        slider.style.setProperty('--volume-fill', `${session.volume}%`);

        document.getElementById('volume-session-icon').src = img.src;
        document.getElementById('volume-session-icon').style.transform = 'scaleY(-1)'; // Because they are originally upside down

        container.classList.add('d-none');
        sliderView.classList.remove('d-none');
      };

      sessionButtons.set(session.name, { button, img });
    } else {
      // Update icon or info if needed
      const { img } = sessionButtons.get(session.name);
      const newSrc = `data:image/png;base64,${session.icon}`;
      if (img.src !== newSrc) img.src = newSrc;
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

  sliderView.classList.add('d-none');
  container.classList.remove('d-none');
}


document.getElementById('volume-slider').addEventListener('input', async function () {
  if (!currentSessionName) return;
  const volume = this.value;

  await fetch(`http://${serverIP}/set_app_volume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_name: currentSessionName, volume: volume })
  });
});

function returnToIcons() {
  currentSessionName = null;
  document.getElementById('volume-slider-view').classList.add('d-none');
  document.getElementById('audio-session-controls').classList.remove('d-none');
}

window.addEventListener('DOMContentLoaded', () => {
  fetchAudioSessions(); 
  setInterval(fetchAudioSessions, 5000); 
});

document.getElementById('volume-slider').addEventListener('input', function () {
  if (!currentSessionName) return;
  const volume = this.value;

  this.style.setProperty('--volume-fill', `${volume}%`); 

  fetch(`http://${serverIP}/set_app_volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_name: currentSessionName, volume: volume })
  });
});
