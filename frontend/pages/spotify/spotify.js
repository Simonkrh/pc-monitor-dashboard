const API_BASE_URL = "http://192.168.1.196:5000";

let lastProgress = 0;
let lastUpdateTime = 0;
let songDuration = 0;
let isPlaying = false;
let trackUpdateRequest;  
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
        document.getElementById("artist-name").innerText = data.item.artists.map(artist => artist.name).join(", ");
        document.getElementById("album-art").src = data.item.album.images[0]?.url || "default.jpg";

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

setInterval(updateSongInfo, 5000);
updateSongInfo();
