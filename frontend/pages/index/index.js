const serverIP = `${CONFIG.SERVER_PC_IP}`;
const macroServerIP = `${CONFIG.MACRO_PC_IP}`;
let mediaFiles = [];

const IMAGE_DISPLAY_MS = 7000;
const VIDEO_READY_TIMEOUT_MS = 12000;
const VIDEO_STALL_TIMEOUT_MS = 15000;
const VIDEO_PRELOAD_MAX_BYTES = 80 * 1024 * 1024;

const dimOverlay =
  document.getElementById("dimOverlay") ||
  (() => {
    const d = document.createElement("div");
    d.id = "dimOverlay";
    document.body.appendChild(d);
    return d;
  })();

async function checkPCStatus() {
  const now = new Date();
  const hour = now.getHours();
  let pcIsOn = false;

  try {
    const response = await fetch(`http://${serverIP}/monitoring/ping`, { method: "GET", cache: "no-store" });

    if (response.ok) {
      const data = await response.json();
      pcIsOn = data.status !== "offline";
    } else {
      throw new Error("Server did not respond");
    }
  } catch (error) {
    console.log("Server is unresponsive:", error);
  }
  // Dim the page if it's after 23:00 and PC is off
  if ((hour >= 23 || hour < 11) && !pcIsOn) {
    // console.log("It's after 23:00 and the PC is off. Dimming the page...");
    dimOverlay.style.opacity  = "0.75";
  }
  // Restore brightness if PC is on OR it's after 11:00 
  else {
    // console.log("PC is up or it's past 11:00. Restoring brightness...");
    dimOverlay.style.opacity = "0";
  }
}

checkPCStatus();
setInterval(checkPCStatus, 30000);

function shuffleArray(array) {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

fetch(`http://${serverIP}/slideshow/media`)
  .then((response) => response.json())
  .then((data) => {
    mediaFiles = shuffleArray(data);
    if (mediaFiles.length > 0) {
      startSlideshow();
    }
  })
  .catch((err) => console.error(err));


function waitForFirstVideoFrame(video, onReady, onFail, timeoutMs = VIDEO_READY_TIMEOUT_MS) {
  let done = false;

  const finish = (ready) => {
    if (done) return;
    done = true;
    if (ready) {
      onReady();
    } else if (onFail) {
      onFail();
    }
  };

  const t = setTimeout(() => finish(false), timeoutMs);

  // Best: fires when a real decoded frame is ready (Chrome/Edge/Android).
  if (video.requestVideoFrameCallback) {
    video.requestVideoFrameCallback(() => {
      clearTimeout(t);
      finish(true);
    });
    return;
  }

  // Fallback: wait until the browser says it has enough decoded data to paint.
  video.addEventListener(
    "loadeddata",
    () => {
      clearTimeout(t);
      requestAnimationFrame(() => finish(true));
    },
    { once: true }
  );
}

function waitForImageDecode(img, cb, timeoutMs = 8000) {
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cb();
  };

  const t = setTimeout(finish, timeoutMs);

  // decode() waits for decode, not just download
  if (img.decode) {
    img
      .decode()
      .then(() => {
        clearTimeout(t);
        finish();
      })
      .catch(() => {
        // Some browsers reject decode() sometimes; fallback
        clearTimeout(t);
        finish();
      });
  } else {
    img.onload = () => {
      clearTimeout(t);
      finish();
    };
  }
}


function startSlideshow() {
  let index = Math.floor(Math.random() * mediaFiles.length);

  const slide1 = document.getElementById("slide1");
  const slide2 = document.getElementById("slide2");

  let currentSlide = slide1;
  let nextSlide = slide2;

  let imageTimer = null;
  let preloadEl = null;
  let videoPreload = null;

  function isVideoFile(fileName) {
    const lower = fileName.toLowerCase();
    return lower.endsWith(".mp4") || lower.endsWith(".webm");
  }

  function getMediaUrl(fileName) {
    return `http://${serverIP}/slideshow/uploads/${encodeURIComponent(fileName)}`;
  }

  function cancelVideoPreload() {
    if (videoPreload && !videoPreload.done) {
      videoPreload.controller.abort();
    }
    videoPreload = null;
  }

  async function readResponseBody(response) {
    if (!response.body) {
      await response.blob();
      return;
    }

    const reader = response.body.getReader();
    let receivedBytes = 0;

    while (true) {
      const result = await reader.read();
      if (result.done) return;

      receivedBytes += result.value.byteLength;
      if (receivedBytes > VIDEO_PRELOAD_MAX_BYTES) {
        await reader.cancel();
        console.warn(`Stopped video preload after ${receivedBytes} bytes`);
        return;
      }
    }
  }

  function warmVideoCache(fileName) {
    if (videoPreload && videoPreload.fileName === fileName) return;

    cancelVideoPreload();

    const controller = new AbortController();
    const preload = {
      fileName,
      controller,
      done: false,
    };
    videoPreload = preload;

    fetch(getMediaUrl(fileName), {
      cache: "force-cache",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentLength = Number(response.headers.get("content-length") || 0);
        if (contentLength > VIDEO_PRELOAD_MAX_BYTES) {
          console.warn(`Skipping full preload for large video "${fileName}" (${contentLength} bytes)`);
          return;
        }

        return readResponseBody(response);
      })
      .then(() => {
        if (videoPreload === preload) {
          preload.done = true;
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.warn(`Could not preload video "${fileName}":`, error);
        }
      });
  }

  function preloadNext(fileName) {
    preloadEl = null;

    if (isVideoFile(fileName)) {
      const currentVideo = currentSlide.querySelector("video");
      if (!currentVideo || currentVideo.paused || currentVideo.ended) {
        warmVideoCache(fileName);
      }
      return;
    }

    cancelVideoPreload();

    const i = new Image();
    i.src = getMediaUrl(fileName);
    preloadEl = i;
  }

  function cleanupSlide(slideEl) {
    const v = slideEl.querySelector("video");
    if (v) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch { }
    }
  }

  function scheduleNextSlide() {
    const currentMedia = currentSlide.querySelector("img, video");
    if (!currentMedia) return;

    // Clear previous timer 
    if (imageTimer) {
      clearTimeout(imageTimer);
      imageTimer = null;
    }

    if (currentMedia.tagName.toLowerCase() === "img") {
      imageTimer = setTimeout(() => transitionToNext("image-timeout"), IMAGE_DISPLAY_MS);
    }
    // Videos transition on "ended" inside displayMedia
  }

  function playVisibleVideo(container) {
    const video = container.querySelector("video");
    if (video && typeof video.startWhenVisible === "function") {
      video.startWhenVisible();
    }
  }

  function transitionToNext(reason) {
    if (imageTimer) {
      clearTimeout(imageTimer);
      imageTimer = null;
    }

    // Advance index first
    index++;
    if (index >= mediaFiles.length) {
      mediaFiles = shuffleArray(mediaFiles);
      index = 0;
    }

    nextSlide.classList.remove("slide-center", "slide-left");
    nextSlide.classList.add("slide-right");

    displayMedia(mediaFiles[index], nextSlide, () => {
      nextSlide.offsetHeight;

      nextSlide.classList.remove("slide-right");
      nextSlide.classList.add("slide-center");

      currentSlide.classList.remove("slide-center");
      currentSlide.classList.add("slide-left");

      setTimeout(() => {
        // cleanup old media (see #2 below)
        cleanupSlide(currentSlide);

        currentSlide.style.transition = "none";
        currentSlide.classList.remove("slide-left", "slide-center", "slide-right");
        currentSlide.classList.add("slide-right");
        currentSlide.innerHTML = "";
        currentSlide.offsetHeight;
        currentSlide.style.transition = "";

        [currentSlide, nextSlide] = [nextSlide, currentSlide];
        playVisibleVideo(currentSlide);
        scheduleNextSlide();
        preloadNext(mediaFiles[(index + 1) % mediaFiles.length]);
      }, 2000);
    }, () => {
      // If next media fails to load, skip to the next item.
      setTimeout(() => transitionToNext("media-load-failed"), 1000);
    }, { deferVideoPlayback: true });
  }


  function displayMedia(fileName, container, onReady, onFail, options = {}) {
    container.innerHTML = "";
    const isVideo = isVideoFile(fileName);
    const url = getMediaUrl(fileName);

    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.loop = false;
      video.controls = false;

      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("muted", "");

      video.src = url;
      container.appendChild(video);

      let endedOrSkipped = false;
      let stallTimer = null;

      const stopWatchdogs = () => {
        clearTimeout(stallTimer);
      };

      const skip = (why) => {
        if (endedOrSkipped) return;
        endedOrSkipped = true;
        stopWatchdogs();
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch { }
        console.warn(`Skipping video "${fileName}": ${why}`);
        if (onFail) onFail();
      };

      video.addEventListener("error", () => skip("error loading/decoding"), { once: true });

      const armStall = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => skip("stalled/buffering"), VIDEO_STALL_TIMEOUT_MS);
      };

      video.addEventListener("waiting", armStall);
      video.addEventListener("stalled", armStall);
      video.addEventListener("playing", () => clearTimeout(stallTimer));
      video.addEventListener("canplay", () => clearTimeout(stallTimer));
      video.addEventListener("timeupdate", () => clearTimeout(stallTimer));

      video.addEventListener("ended", () => {
        stopWatchdogs();
        transitionToNext("video-ended");
      });

      video.startWhenVisible = () => {
        if (endedOrSkipped) return;
        video.play().catch(() => skip("autoplay blocked"));
      };

      video.load();

      // Try to play
      video.play().catch(() => {
      });

      waitForFirstVideoFrame(video, () => {
        clearTimeout(stallTimer);
        if (options.deferVideoPlayback) {
          video.pause();
        }
        if (onReady) onReady();
        if (!options.deferVideoPlayback) {
          video.startWhenVisible();
        }
      }, () => {
        skip("timed out waiting for first frame");
      });

    } else {
      const img = document.createElement("img");
      img.src = url;
      img.loading = "eager";
      img.decoding = "async";
      container.appendChild(img);

      img.onerror = () => {
        console.error(`Failed to load image: ${fileName}`);
        if (onFail) onFail();
      };

      waitForImageDecode(img, () => {
        if (onReady) onReady();
      });
    }
  }

  // Start first slide, then warm the following media once playback/display is settled.
  displayMedia(mediaFiles[index], currentSlide, scheduleNextSlide, () => {
    setTimeout(() => transitionToNext("initial-media-load-failed"), 1000);
  });
  requestAnimationFrame(() => {
    preloadNext(mediaFiles[(index + 1) % mediaFiles.length]);
  });
}


let swipeStartY = 0;
let swipeEndY = 0;
const swipeThreshold = 150;

document.addEventListener("touchstart", (event) => {
  swipeStartY = event.touches[0].clientY;
});

document.addEventListener("touchmove", (event) => {
  swipeEndY = event.touches[0].clientY;
});

document.addEventListener("mousedown", (event) => {
  swipeStartY = event.clientY;
});

document.addEventListener("mousemove", (event) => {
  swipeEndY = event.clientY;
});

document.addEventListener("mouseup", handleSwipe);
document.addEventListener("touchend", handleSwipe);

function handleSwipe() {
  if (swipeStartY - swipeEndY > swipeThreshold) {
    console.log("Swipe up detected - waking PC...");
    wakeAndRedirect();
  }
}

function wakeAndRedirect() {
  console.log("Sending Wake-on-LAN request...");

  document.getElementById("loading-spinner").style.display = "flex";

  fetch(`http://${serverIP}/monitoring/wake`, { method: "POST" })
    .then(response => response.json())
    .then(data => {
      console.log(data.status);
      waitForPCAndMaybeMacro();
    })
    .catch(error => {
      console.error("Failed to send WoL request:", error);
      const defaultPage = getDefaultPage();
      window.location.href = defaultPage;

    });
}

function getDefaultPage() {
  const hiddenPages = JSON.parse(localStorage.getItem("hiddenPages")) || [];
  const candidate = localStorage.getItem("defaultPage") || "/dashboard";
  if (!hiddenPages.includes(candidate)) {
    return candidate;
  }
  const fallbackOrder = ["/dashboard", "/spotify", "/resources"];
  return fallbackOrder.find((p) => !hiddenPages.includes(p)) || "/dashboard";
}

async function waitForPCAndMaybeMacro() {
  let attempts = 0;
  const maxAttempts = 40;
  const intervalMs = 3000;
  const defaultPage = getDefaultPage();

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // If PC online
      const pingRes = await fetch(`http://${serverIP}/monitoring/ping`, {
        method: "GET",
        cache: "no-store",
      });

      if (!pingRes.ok) throw new Error("ping endpoint not ok");

      const pingData = await pingRes.json();
      const pcOnline = pingData.status && pingData.status !== "offline";

      if (!pcOnline) {
        console.log(`Waiting for PC... (${attempts}/${maxAttempts})`);
        await sleep(intervalMs);
        continue;
      }

      // If macro server running
      const macroRes = await fetch(`http://${macroServerIP}/macros`, {
        method: "GET",
        cache: "no-store",
      });

      if (macroRes.ok) {
        console.log("PC is online and Macro Server is responding!");
        window.location.href = defaultPage;
        return;
      } else {
        console.log(`PC online, macro server not ready (HTTP ${macroRes.status})...`);
      }

    } catch (e) {
      console.log(`Waiting... (${attempts}/${maxAttempts})`, e?.message || e);
    }

    await sleep(intervalMs);
  }

  console.log("Timed out waiting — redirecting anyway.");
  window.location.href = defaultPage;
}
