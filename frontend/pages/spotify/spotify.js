const API_BASE_URL = "http://192.168.1.196:5001";
const DEAFULT_PLAYLIST = "4TGxJb0nQLc4bDg0DtasLE";

let currentPlayingUri = null;
let currentPlaylistId = null;
let currentlyLoadedPlaylist  = null;

let lastProgress = 0;
let lastUpdateTime = 0;
let songDuration = 0;
let isPlaying = false;
let trackUpdateRequest;

// Existing sendCommand function
async function sendCommand(command) {
  try {
    let requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json" 
      },
    };

    // If sending a request with a body, make sure to include it as JSON
    if (command === "play") {
      requestOptions.body = JSON.stringify({});
    }

    const response = await fetch(`${API_BASE_URL}/${command}`, requestOptions);
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

    lastProgress = data.progress_ms || 0;
    songDuration = data.item.duration_ms || 0;
    lastUpdateTime = Date.now();
    isPlaying = data.is_playing;

    currentPlayingUri = data.item.uri; 
    currentPlaylistId = data.context?.uri?.split(":").pop() || null; 
    
    updatePlayPauseIcon(isPlaying);
    updateTrackTime();

    highlightPlayingSong();
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
  isPlaying = !isPlaying;
  updatePlayPauseIcon(isPlaying);

  if (isPlaying) {
    trackUpdateRequest = requestAnimationFrame(updateTrackTime);
    sendCommand("play");
  } else {
    cancelAnimationFrame(trackUpdateRequest);
    sendCommand("pause");
  }
}

async function loadPlaylist(playlistId) {
    try {
      currentlyLoadedPlaylist = playlistId; 

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
        li.dataset.trackUri = track.uri;
  
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
          console.log(track.uri);
          playTrack(track.uri, playlistId);
        });
  
        playlistUl.appendChild(li);

        highlightPlayingSong();
      });
    } catch (error) {
      console.error("Error loading playlist:", error);
    }
  }
  

async function playTrack(trackUri, trackPlaylistId) {
  try {
    const response = await fetch(`${API_BASE_URL}/play-track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uri: trackUri, playlistId: trackPlaylistId}),
    });
    const data = await response.json();

    if (data.error) {
      console.error("Error playing track:", data.error);
      return;
    }

    currentPlayingUri = trackUri; 
    highlightPlayingSong();

    setTimeout(updateSongInfo, 1000);
  } catch (error) {
    console.error("Error playing track:", error);
  }
}

function highlightPlayingSong() {
  const playlistItems = document.querySelectorAll("#playlist .list-group-item");

  playlistItems.forEach((li) => {
    if (li.dataset.trackUri === currentPlayingUri) {
      li.classList.add("playing-highlight");
    } else {
      li.classList.remove("playing-highlight");
    }
  });
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
    volumeSlider.style.setProperty("--volume-fill", `${data.volume_percent}%`);
  } catch (error) {
    console.error("Error getting volume:", error);
  }
}

async function loadPlaylists() {
  try {
    const response = await fetch(`${API_BASE_URL}/playlists`);
    const data = await response.json();

    if (data.error) {
      console.error("Error fetching playlists:", data.error);
      return;
    }

    const playlistTitle = document.getElementById("playlist-title");
    if (playlistTitle) {
      playlistTitle.innerText = "My Playlists";
    }

    const playlistUl = document.getElementById("playlist");
    playlistUl.innerHTML = ""; // Clear existing items

    data.items.forEach((playlist) => {
      const li = document.createElement("li");
      li.classList.add("list-group-item", "d-flex", "align-items-center");

      const playlistImages = playlist.images;
      const playlistCoverUrl =
        playlistImages.length > 0 ? playlistImages[0].url : "default.jpg";

      const img = document.createElement("img");
      img.src = playlistCoverUrl;
      img.alt = playlist.name;
      img.style.width = "40px";
      img.style.height = "40px";
      img.style.objectFit = "cover";
      img.style.marginRight = "10px";

      const textDiv = document.createElement("div");
      textDiv.innerText = playlist.name;

      li.addEventListener("click", () => {
        loadPlaylist(playlist.id); 
      });

      li.appendChild(img);
      li.appendChild(textDiv);
      playlistUl.appendChild(li);
    });
  } catch (error) {
    console.error("Error loading playlists:", error);
  }
}

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


async function goToCurrentPlaylist() {
  await updateSongInfo(); 

  if (!currentPlaylistId) {
    console.warn("No associated playlist for the current song.");
    return;
  }

  if (currentlyLoadedPlaylist !== currentPlaylistId) {
    console.log(`Loading playlist ${currentPlaylistId}...`);
    await loadPlaylist(currentPlaylistId); 
  }

  setTimeout(scrollToHighlightedSong, 500); // Scroll after loading
}

function scrollToHighlightedSong() {
  const highlightedSong = document.querySelector(".playing-highlight");
  if (highlightedSong) {
    highlightedSong.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  updateSongInfo();
  loadPlaylist(DEAFULT_PLAYLIST);
  getSpotifyVolume(); 

  const volumeSlider = document.getElementById("volume-slider");
  if (volumeSlider) {
    function updateSliderBackground() {
      let value = volumeSlider.value;
      let percent = (value / volumeSlider.max) * 100;
      volumeSlider.style.setProperty("--volume-fill", `${100 - percent}%`);
    }

    volumeSlider.addEventListener("input", updateSliderBackground);
    updateSliderBackground();
  }

  const infoWrapper = document.getElementById("album-art");
  if (infoWrapper) {
    infoWrapper.addEventListener("click", goToCurrentPlaylist);
  }

  const musicIcon = document.getElementById("playlist-icon");
  if (musicIcon) {
    musicIcon.addEventListener("click", loadPlaylists);
  }
});

setInterval(updateSongInfo, 10000);
