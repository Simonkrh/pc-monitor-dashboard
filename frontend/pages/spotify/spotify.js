const API_BASE_URL = "http://192.168.1.196:5000";

let lastProgress = 0;
let lastUpdateTime = 0;
let songDuration = 0;
let isPlaying = false;
let trackUpdateRequest;

// Existing sendCommand function
async function sendCommand(command) {
  try {
    if (command === "play") {
      isPlaying = true;
      updatePlayPauseIcon(true);
      updateTrackTime();
    } else if (command === "pause") {
      isPlaying = false;
      updatePlayPauseIcon(false);
    }

    // Send command to Spotify API
    const response = await fetch(`${API_BASE_URL}/${command}`, { method: "POST" });
    const data = await response.json();
    console.log(`Command sent: ${command}`, data);

    if (command === "pause" || command === "play") {
      setTimeout(updateSongInfo, 1000);
    }

    if (command === "next" || command === "prev") {
      setTimeout(updateSongInfo, 1000);
    }
  } catch (error) {
    console.error("Error sending command:", error);
  }
}

async function updateSongInfo() {
  try {
    const response = await fetch(`${API_BASE_URL}/current-song`);
    const data = await response.json();

    if (!data || data.error) {
      document.getElementById("song-title").innerText = "No song playing";
      document.getElementById("artist-name").innerText = "";
      document.getElementById("album-art").src = "default.jpg";
      updatePlayPauseIcon(false);
      isPlaying = false;
      updateTrackProgress(0, 0);
      return;
    }

    // Update UI with song info
    document.getElementById("song-title").innerText = data.item.name;
    document.getElementById("artist-name").innerText = data.item.artists
      .map((artist) => artist.name)
      .join(", ");
    document.getElementById("album-art").src =
      data.item.album.images[0]?.url || "default.jpg";

    // Store progress info for local tracking
    lastProgress = data.progress_ms || 0;
    songDuration = data.item.duration_ms || 0;
    lastUpdateTime = Date.now();
    isPlaying = data.is_playing;

    updatePlayPauseIcon(isPlaying);
    updateTrackTime();
  } catch (error) {
    console.error("Error fetching song info:", error);
  }
}

function updateTrackTime() {
  if (!isPlaying) return;

  const elapsedTime = Date.now() - lastUpdateTime;
  const currentProgress = lastProgress + elapsedTime;
  const clampedProgress = Math.min(currentProgress, songDuration);

  document.getElementById("current-time").innerText = formatTime(clampedProgress);
  document.getElementById("total-time").innerText = formatTime(songDuration);

  updateTrackProgress(clampedProgress, songDuration);

  trackUpdateRequest = requestAnimationFrame(updateTrackTime);
}

function updateTrackProgress(currentProgress, totalDuration) {
  const progressBar = document.querySelector(".progress-bar");
  let progressPercentage = (currentProgress / totalDuration) * 100;
  if (!totalDuration) {
    progressPercentage = 0;
  }
  progressBar.style.width = `${progressPercentage}%`;
}

function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function updatePlayPauseIcon(isPlaying) {
  const icon = document.getElementById("play-pause-icon");
  icon.classList.toggle("fa-play", !isPlaying);
  icon.classList.toggle("fa-pause", isPlaying);
}

async function togglePlayPause() {
  if (isPlaying) {
    sendCommand("pause");
    cancelAnimationFrame(trackUpdateRequest);
  } else {
    sendCommand("play");
  }
}

async function loadPlaylist(playlistId) {
    try {
      const response = await fetch(`${API_BASE_URL}/playlist/${playlistId}`);
      const data = await response.json();
  
        if (data.error) {
        console.error("Error fetching playlist:", data.error);
        return;
        }
      
      const playlistTitle = document.getElementById("playlist-title");
        if (playlistTitle) {
        playlistTitle.innerText = data.name || "Unknown Playlist";
      }
    
      const playlistUl = document.getElementById("playlist");
      playlistUl.innerHTML = ""; // clear old items if any
  
      data.tracks.items.forEach((item) => {
        const track = item.track; 
        if (!track) return; // skip if no track
  
        const li = document.createElement("li");
        li.classList.add("list-group-item", "d-flex", "align-items-center");
  
        const albumImages = track.album.images;
        const albumCoverUrl = albumImages.length 
          ? albumImages[albumImages.length - 1].url // smallest image
          : "default.jpg";
  
        // <img> for album cover
        const img = document.createElement("img");
        img.src = albumCoverUrl;
        img.alt = track.name;
        img.style.width = "40px";
        img.style.height = "40px";
        img.style.objectFit = "cover";
        img.style.marginRight = "10px";
  
        // <div> for the text (track name + artists)
        const textDiv = document.createElement("div");
        textDiv.innerText = `${track.name} - ${track.artists
          .map((artist) => artist.name)
          .join(", ")}`;
  
        li.appendChild(img);
        li.appendChild(textDiv);
  
        li.addEventListener("click", () => {
          playTrack(track.uri);
        });
  
        playlistUl.appendChild(li);
      });
    } catch (error) {
      console.error("Error loading playlist:", error);
    }
  }
  

async function playTrack(trackUri) {
  try {
    const response = await fetch(`${API_BASE_URL}/play-track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uri: trackUri }),
    });
    const data = await response.json();

    if (data.error) {
      console.error("Error playing track:", data.error);
      return;
    }

    setTimeout(updateSongInfo, 1000);
  } catch (error) {
    console.error("Error playing track:", error);
  }
}

async function getSpotifyVolume() {
  try {
    const response = await fetch(`${API_BASE_URL}/get-volume`);
    const data = await response.json();

    if (data.error) {
      console.error("Error fetching volume:", data.error);
      return;
    }

    const volumeSlider = document.getElementById("volume-slider");
    volumeSlider.value = 100 - data.volume_percent; // Inverting if needed
    volumeSlider.style.setProperty("--volume-fill", `${100 - volumeSlider.value}%`);
  } catch (error) {
    console.error("Error getting volume:", error);
  }
}

document.addEventListener("DOMContentLoaded", getSpotifyVolume);

const volumeSlider = document.getElementById("volume-slider");
let debounceTimeout;
async function setSpotifyVolume(volume) {
  clearTimeout(debounceTimeout); 

  debounceTimeout = setTimeout(async () => {
    const invertedVolume = 100 - volume; 

    try {
      const response = await fetch(`${API_BASE_URL}/set-volume?volume=${invertedVolume}`, {
        method: "PUT",
      });

      if (!response.ok) {
        console.error("Error setting volume:", await response.text());
      } else {
        console.log(`Spotify volume set to ${invertedVolume}%`);
      }
    } catch (error) {
      console.error("Error sending volume command:", error);
    }
  }, 300); 
}

volumeSlider.addEventListener("input", (event) => {
  const volume = event.target.value;
  setSpotifyVolume(volume);
});


document.addEventListener("DOMContentLoaded", function () {
  const volumeSlider = document.getElementById("volume-slider");

  function updateSliderBackground() {
    let value = volumeSlider.value; 
    let percent = (value / volumeSlider.max) * 100; 

    // Apply gradient fill dynamically
    volumeSlider.style.setProperty("--volume-fill", `${100 - percent}%`);
  }
  volumeSlider.addEventListener("input", updateSliderBackground);
  
  updateSliderBackground();
});


setInterval(updateSongInfo, 5000);
updateSongInfo();
loadPlaylist("4TGxJb0nQLc4bDg0DtasLE");
