const serverIP = `${CONFIG.SERVER_PC_IP}`;
const API_BASE_URL = `http://${serverIP}/spotify`;

let currentPlayingUri = null;
let currentPlaylistId = null;
let currentlyLoadedPlaylist = null;
let clickBlocked = false;
let playlistRequestId = 0;
let playlistController = null;
const playlistCache = new Map();
const PLAYLIST_CACHE_MS = 60000;
const DEFAULT_ART = "/frontend/pages/spotify/placeholder.svg";

let lastProgress = 0;
let lastUpdateTime = 0;
let songDuration = 0;
let isPlaying = false;
let trackUpdateRequest;
let songInfoRequestId = 0;
let playPausePending = null; // { desired: boolean, startedAt: number, stableSince: number | null }
let playPauseSyncTimeouts = [];

function clearPlayPauseSyncTimeouts() {
  playPauseSyncTimeouts.forEach((t) => clearTimeout(t));
  playPauseSyncTimeouts = [];
}

function scheduleSongInfoRefresh(delaysMs) {
  delaysMs.forEach((delay) => {
    playPauseSyncTimeouts.push(setTimeout(updateSongInfo, delay));
  });
}

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

    if (command === "pause" || command === "play") {
      // Spotify state can take a moment to reflect the change; refresh a few times.
      if (!playPausePending) {
        setTimeout(updateSongInfo, 400);
        setTimeout(updateSongInfo, 1000);
        setTimeout(updateSongInfo, 2000);
      }
    }

    if (command === "next" || command === "prev") {
      setTimeout(async () => {
        await updateSongInfo();
        scrollToHighlightedSong();
      }, 1000);
    }
  } catch (error) {
    console.error("Error sending command:", error);
  }
}

function showPlayerMessage(state = "offline") {
  const messages = {
    idle: ["Waiting for Spotify", "Play something in Spotify to see it here."],
    offline: ["Waiting for Spotify", "We’ll reconnect automatically."],
    auth: ["Reconnect Spotify", "Check your Spotify connection in Settings → Config."],
  };
  const [title, detail] = messages[state];
  document.getElementById("song-title").innerText = title;
  document.getElementById("artist-name").innerText = detail;
  document.getElementById("album-art").src = DEFAULT_ART;
  document.getElementById("album-art").alt = "";
  document.getElementById("song-info").classList.add("is-unavailable");
  document.getElementById("open-spotify-btn").hidden = false;
  currentPlaylistId = null;
  currentPlayingUri = null;
  isPlaying = false;
  playPausePending = null;
  clearPlayPauseSyncTimeouts();
  if (trackUpdateRequest) cancelAnimationFrame(trackUpdateRequest);
  updatePlayPauseIcon(false);
  updateTrackProgress(0, 0);
  document.getElementById("current-track-time").innerText = "0:00";
  document.getElementById("total-track-time").innerText = "0:00";
  highlightPlayingSong();
  highlightPlayingPlaylist();
}

async function openSpotify(event) {
  event.preventDefault();
  const button = document.getElementById("open-spotify-btn");
  if (button.disabled) return;
  button.disabled = true;
  try {
    const macroHost = (CONFIG.MACRO_PC_IP || "").trim();
    if (!macroHost) throw new Error("Macro Server address is not configured");
    const response = await fetch(`http://${macroHost}/open_app`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_path: "spotify:" }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok || !data || data.error) throw new Error("Gaming PC could not launch Spotify");
    setTimeout(updateSongInfo, 1000);
    return;
  } catch (error) {
    console.error("Could not open Spotify:", error);
    document.getElementById("artist-name").innerText = "Failed to open Spotify on your gaming PC. Please open it manually.";
  } finally {
    button.disabled = false;
  }
}

async function updateSongInfo() {
  const requestId = ++songInfoRequestId;
  try {
    const response = await fetch(`${API_BASE_URL}/current-song`, { signal: AbortSignal.timeout(10000) });
    if (requestId !== songInfoRequestId) return;
    if (response.status === 401 || response.status === 403) {
      showPlayerMessage("auth");
      return;
    }
    if (!response.ok && response.status !== 204) {
      showPlayerMessage();
      return;
    }
    const data = response.status === 204 ? null : await response.json();

    // Ignore out-of-order responses (can happen with multiple overlapping refreshes)
    if (requestId !== songInfoRequestId) return;

    if (!data || data.error || !data.item) {
      showPlayerMessage(data?.error ? "offline" : "idle");
      return;
    }

    // Update UI with song info
    document.getElementById("song-info").classList.remove("is-unavailable");
    document.getElementById("open-spotify-btn").hidden = true;
    document.getElementById("album-art").alt = "Album art";
    document.getElementById("song-title").innerText = data.item.name;
    document.getElementById("artist-name").innerText = (data.item.artists || [])
      .map((artist) => artist.name)
      .join(", ");
    document.getElementById("album-art").src =
      data.item.album?.images?.[0]?.url || data.item.images?.[0]?.url || DEFAULT_ART;

    lastProgress = data.progress_ms || 0;
    songDuration = data.item.duration_ms || 0;
    lastUpdateTime = Date.now();
    const serverIsPlaying = !!data.is_playing;

    currentPlayingUri = data.item.uri;
    currentPlaylistId = data.context?.uri?.startsWith("spotify:playlist:")
      ? data.context.uri.split(":").pop() : null;

    // Prevent play/pause icon flicker while Spotify is still transitioning states.
    let effectiveIsPlaying = serverIsPlaying;
    if (playPausePending) {
      const ageMs = Date.now() - playPausePending.startedAt;
      if (ageMs <= 8000) {
        if (serverIsPlaying === playPausePending.desired) {
          if (playPausePending.stableSince == null) {
            playPausePending.stableSince = Date.now();
          } else if (Date.now() - playPausePending.stableSince >= 900) {
            playPausePending = null;
          }
        } else {
          playPausePending.stableSince = null;
        }

        if (playPausePending) {
          effectiveIsPlaying = playPausePending.desired;
        }
      } else {
        playPausePending = null;
      }
    }

    isPlaying = effectiveIsPlaying;
    updatePlayPauseIcon(effectiveIsPlaying);
    if (trackUpdateRequest) cancelAnimationFrame(trackUpdateRequest);
    updateTrackTime();

    highlightPlayingSong();
    highlightPlayingPlaylist();
  } catch (error) {
    if (requestId !== songInfoRequestId) return;
    console.error("Error fetching song info:", error);
    showPlayerMessage();
  }
}


function updateTrackTime() {
  if (!isPlaying) return;

  const elapsedTime = Date.now() - lastUpdateTime;
  const currentProgress = lastProgress + elapsedTime;
  const clampedProgress = Math.min(currentProgress, songDuration);

  document.getElementById("current-track-time").innerText = formatTime(clampedProgress);
  document.getElementById("total-track-time").innerText = formatTime(songDuration);

  updateTrackProgress(clampedProgress, songDuration);

  if (clampedProgress >= songDuration - 2000) {
    setTimeout(() => {
      updateSongInfo().then(() => {
        scrollToHighlightedSong();
      });
    }, 1500);
  } else {
    trackUpdateRequest = requestAnimationFrame(updateTrackTime);
  }
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

async function fetchPlayerState() {
  try {
    const response = await fetch(`${API_BASE_URL}/player-state`);
    const data = await response.json();

    if (data.error) {
      console.error("Error fetching player state:", data.error);
      return;
    }

    updateShuffleIcon(data.shuffle_state);
    updateRepeatIcon(data.repeat_state);
  } catch (error) {
    console.error("Error fetching player state:", error);
  }
}

async function togglePlayPause() {
  const desired = !isPlaying;

  clearPlayPauseSyncTimeouts();
  playPausePending = { desired, startedAt: Date.now(), stableSince: null };

  isPlaying = desired;
  updatePlayPauseIcon(desired);

  if (desired) {
    trackUpdateRequest = requestAnimationFrame(updateTrackTime);
    sendCommand("play");
  } else {
    if (trackUpdateRequest) cancelAnimationFrame(trackUpdateRequest);
    sendCommand("pause");
  }

  // Extra refreshes to settle the UI quickly even if Spotify lags a bit.
  scheduleSongInfoRefresh([250, 750, 1500, 3000, 5000]);
}

async function toggleRepeat() {
  const repeatIcon = document.getElementById("repeat-icon");

  try {
    const response = await fetch(`${API_BASE_URL}/repeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json();
    if (data.success) {
      const repeatMode = data.mode;
      updateRepeatIcon(repeatMode);
    }
  } catch (error) {
    console.error("Error toggling repeat:", error);
  }
}

function updateRepeatIcon(mode) {
  const repeatIcon = document.getElementById("repeat-icon");
  repeatIcon.classList.remove("active-green");

  if (mode === "track") {
    repeatIcon.classList.add("active-green");
  }
}

async function toggleShuffle() {
  const shuffleIcon = document.getElementById("shuffle-icon");

  try {
    const response = await fetch(`${API_BASE_URL}/shuffle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json();
    if (data.success) {
      const isShuffle = data.shuffle_state;
      updateShuffleIcon(isShuffle);
    } else {
      console.warn("Could not toggle shuffle:", data.error);
    }
  } catch (error) {
    console.error("Error toggling shuffle:", error);
  }
}

function updateShuffleIcon(isShuffle) {
  const shuffleIcon = document.getElementById("shuffle-icon");
  shuffleIcon.classList.toggle("active-green", isShuffle);
}

function renderPlaylistFeedback(title, message) {
  const playlistTitle = document.getElementById("playlist-title");
  if (playlistTitle) {
    playlistTitle.innerText = title;
  }

  const playlistUl = document.getElementById("playlist");
  if (!playlistUl) return;

  playlistUl.innerHTML = "";

  setPlaylistStatus(message);
}

function setPlaylistStatus(message, retry, retryAfter = 0) {
  document.getElementById("playlist-status")?.remove();
  if (!message) return;
  const item = document.createElement("li");
  item.id = "playlist-status";
  item.classList.add("list-group-item", "playlist-feedback");
  item.setAttribute("role", "status");
  const text = document.createElement("span");
  text.innerText = message;
  item.appendChild(text);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("playlist-retry");
    button.innerText = "Retry";
    button.disabled = retryAfter > 0;
    if (retryAfter > 0) setTimeout(() => { button.disabled = false; }, retryAfter * 1000);
    button.addEventListener("click", () => {
      if (!clickBlocked && !button.disabled) retry();
    });
    item.appendChild(button);
  }
  document.getElementById("playlist").appendChild(item);
}

async function fetchPlaylistPage(path, signal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 30000);
  try {
    if (signal.aborted) controller.abort();
    const response = await fetch(`${API_BASE_URL}/${path}`, { signal: controller.signal });
    const data = await response.json();
    if (!response.ok || data.error) {
      const error = new Error(typeof data.error === "string" ? data.error : "Could not load this playlist. Please retry.");
      error.retryAfter = Number(data.retry_after) || 0;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError" && !signal.aborted) {
      throw new Error("Loading took too long. Please retry.");
    }
    if (error instanceof TypeError || error instanceof SyntaxError) {
      throw new Error("Could not reach the Spotify service. Check the connection and retry.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

function appendPlaylistItems(items, playlistId) {
  const fragment = document.createDocumentFragment();
  let count = 0;
  for (const item of items) {
    const entry = playlistId ? (item?.item ?? item?.track) : item;
    if (!entry || (playlistId ? !entry.uri : !entry.id)) continue;
    const li = document.createElement("li");
    li.classList.add("list-group-item", "d-flex", "align-items-center");
    if (playlistId) li.dataset.trackUri = entry.uri;
    else li.dataset.playlistId = entry.id;
    const images = entry.album?.images || entry.images || [];
    const img = document.createElement("img");
    img.src = images[images.length - 1]?.url || DEFAULT_ART;
    img.alt = "";
    img.loading = "lazy";
    const text = document.createElement("div");
    const artists = (entry.artists || []).map((artist) => artist.name).join(", ");
    text.innerText = `${entry.name || "Unavailable item"}${artists ? ` - ${artists}` : ""}`;
    li.appendChild(img);
    li.appendChild(text);
    li.addEventListener("click", (event) => {
      if (clickBlocked) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (playlistId) playTrack(entry.uri, playlistId);
      else loadPlaylist(entry.id, entry.name);
    });
    fragment.appendChild(li);
    count++;
  }
  document.getElementById("playlist").appendChild(fragment);
  highlightPlayingSong();
  highlightPlayingPlaylist();
  return count;
}

async function loadPlaylistView(playlistId = null, title = "Playlist") {
  const requestId = ++playlistRequestId;
  playlistController?.abort();
  const controller = new AbortController();
  playlistController = controller;
  currentlyLoadedPlaylist = null;
  const key = playlistId || "my-playlists";
  let name = playlistId ? title : "My Playlists";
  renderPlaylistFeedback(name, "Loading…");
  const container = document.querySelector(".playlist-container");
  if (container) container.scrollTop = 0;
  const cached = playlistCache.get(key);
  if (cached && Date.now() - cached.savedAt < PLAYLIST_CACHE_MS) {
    setPlaylistStatus("");
    document.getElementById("playlist-title").innerText = cached.name;
    const count = appendPlaylistItems(cached.items, playlistId);
    if (!count) setPlaylistStatus(playlistId ? "No available songs in this playlist." : "No playlists found.");
    currentlyLoadedPlaylist = playlistId;
    return true;
  }

  let offset = 0;
  let count = 0;
  const items = [];
  async function loadRemaining() {
    if (requestId !== playlistRequestId) return false;
    try {
      do {
        setPlaylistStatus(count ? "Loading more…" : "Loading…");
        const path = playlistId ? `playlist/${encodeURIComponent(playlistId)}` : "playlists";
        const data = await fetchPlaylistPage(`${path}?offset=${offset}`, controller.signal);
        // Aborting fetch alone is insufficient if its response has already arrived.
        if (requestId !== playlistRequestId) return false;
        const page = playlistId ? (data.tracks || data.items) : data;
        if (!Array.isArray(page?.items)) throw new Error("Received an incomplete playlist. Please retry.");
        const next = page.next_offset ?? null;
        if (next !== null && (!Number.isInteger(next) || next <= offset || !page.items.length)) {
          throw new Error("Received an incomplete playlist page. Please retry.");
        }
        if (playlistId && data.name) name = data.name;
        document.getElementById("playlist-title").innerText = name;
        setPlaylistStatus("");
        count += appendPlaylistItems(page.items, playlistId);
        items.push(...page.items);
        offset = next;
      } while (offset !== null);
      if (!count) setPlaylistStatus(playlistId ? "No available songs in this playlist." : "No playlists found.");
      currentlyLoadedPlaylist = playlistId;
      playlistCache.delete(key);
      playlistCache.set(key, { name, items, savedAt: Date.now() });
      // Keep a small, short-lived memory cache for quick back-and-forth navigation.
      if (playlistCache.size > 10) playlistCache.delete(playlistCache.keys().next().value);
      return true;
    } catch (error) {
      if (requestId !== playlistRequestId || controller.signal.aborted) return false;
      setPlaylistStatus(`${count ? "Some items are loaded. " : ""}${error.message}`, loadRemaining, error.retryAfter);
      return false;
    }
  }
  return loadRemaining();
}

function loadPlaylist(playlistId, name) {
  return loadPlaylistView(playlistId, name);
}

async function playTrack(trackUri, trackPlaylistId) {
  try {
    const response = await fetch(`${API_BASE_URL}/play-track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uri: trackUri, playlistId: trackPlaylistId }),
    });
    const data = await response.json();

    if (data.error) {
      if (data.error === "No active Spotify device found") {
        showPlayerMessage("idle");
      }

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

function highlightPlayingPlaylist() {
  const playlistItems = document.querySelectorAll("#playlist .list-group-item");

  playlistItems.forEach((li) => {
    if (li.dataset.playlistId && li.dataset.playlistId === currentPlaylistId) {
      li.classList.add("playing-playlist-highlight");
    } else {
      li.classList.remove("playing-playlist-highlight");
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

function loadPlaylists() {
  return loadPlaylistView();
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
  const requestId = playlistRequestId;
  await updateSongInfo();
  if (requestId !== playlistRequestId) return;

  if (!currentPlaylistId) {
    console.warn("No associated playlist for the current song.");
    ++playlistRequestId;
    playlistController?.abort();
    currentlyLoadedPlaylist = null;
    renderPlaylistFeedback(
      "No playlist context",
      "The current track is not playing from a playlist."
    );
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

function blockClicksFor(ms) {
  clickBlocked = true;
  setTimeout(() => {
    clickBlocked = false;
  }, ms);
}

document.addEventListener("DOMContentLoaded", async function () {
  getSpotifyVolume();
  fetchPlayerState();

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
    infoWrapper.addEventListener("click", () => {
      if (currentPlayingUri) goToCurrentPlaylist();
    });
  }
  document.getElementById("open-spotify-btn").addEventListener("click", openSpotify);

  const playlistsButton = document.getElementById("playlist-home-btn");
  if (playlistsButton) {
    playlistsButton.addEventListener("click", loadPlaylists);
  }

  document.querySelectorAll(".controls i, .shuffle i, .repeat i, #playlist-home-btn").forEach((clickTarget) => {
    clickTarget.addEventListener("click", () => {
      clickTarget.style.transform = "scale(1.2)";
      setTimeout(() => {
        clickTarget.style.transform = "scale(1)";
      }, 150);
    });
  });

  // Bind navigation before waiting for the network so the panel stays usable.
  const requestId = playlistRequestId;
  renderPlaylistFeedback("Playlists", "Loading...");
  await updateSongInfo();
  if (requestId !== playlistRequestId) return;
  if (currentPlaylistId) await loadPlaylist(currentPlaylistId);
  else await loadPlaylists();
  scrollToHighlightedSong();
});

setInterval(() => {
  if (window.appViewIsActive && !window.appViewIsActive()) return;
  updateSongInfo();
  fetchPlayerState();
}, 10000);

window.addEventListener("appViewVisibilityChange", (event) => {
  if (!event.detail.active) return;
  updateSongInfo();
  fetchPlayerState();
  getSpotifyVolume();
});
