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

async function fetchAudioSessions() {
  const container = document.getElementById('audio-session-controls');
  const sliderView = document.getElementById('volume-slider-view');
  const slider = document.getElementById('volume-slider');
  const sessionLabel = document.getElementById('volume-session-name');

  container.innerHTML = '';
  sliderView.classList.add('d-none');
  container.classList.remove('d-none');

  const response = await fetch(`http://${serverIP}/audio_sessions`);
  const sessions = await response.json();

  sessions.forEach(session => {
    const button = document.createElement('button');
    button.className = 'macro-btn'; 

    const img = document.createElement('img');
    img.src = `data:image/png;base64,${session.icon}`;
    img.className = 'macro-icon'; 
    img.alt = session.name;
    img.title = session.name;
    img.style.transform = 'scaleY(-1)';

    button.appendChild(img);

    button.onclick = () => {
      currentSessionName = session.name;
      
      const slider = document.getElementById('volume-slider');
      slider.value = session.volume;
      slider.style.setProperty('--volume-fill', `${session.volume}%`); 
  
      document.getElementById('volume-session-icon').src = `data:image/png;base64,${session.icon}`;
      document.getElementById('volume-session-icon').style.transform = 'scaleY(-1)';
  
      container.classList.add('d-none');
      sliderView.classList.remove('d-none');
  };

    container.appendChild(button);
  });
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

window.addEventListener('DOMContentLoaded', fetchAudioSessions);

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
