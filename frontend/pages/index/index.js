const serverIP = `${CONFIG.SERVER_PC_IP}`;
const macroServerIP = `${CONFIG.MACRO_PC_IP}`;
let images = [];

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


function waitForFirstVideoFrame(video, cb, timeoutMs = 8000) {
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cb();
  };

  const t = setTimeout(() => finish(), timeoutMs);

  // Best: fires when a real frame is ready (Chrome/Edge/Android)
  if (video.requestVideoFrameCallback) {
    video.requestVideoFrameCallback(() => {
      clearTimeout(t);
      finish();
    });
    return;
  }

  // Fallback: wait for "playing" (usually means frames are flowing)
  video.addEventListener(
    "playing",
    () => {
      clearTimeout(t);
      // next tick so layout/paint catches up
      requestAnimationFrame(finish);
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

  function preloadNext(fileName) {
    const lower = fileName.toLowerCase();
    const url = `http://${serverIP}/slideshow/uploads/${encodeURIComponent(fileName)}`;

    preloadEl = null;

    if (lower.endsWith(".mp4") || lower.endsWith(".webm")) {
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      v.load();
      preloadEl = v;
    } else {
      const i = new Image();
      i.src = url;
      preloadEl = i;
    }
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
      imageTimer = setTimeout(() => transitionToNext("image-timeout"), 7000);
    }
    // Videos transition on "ended" inside displayMedia
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

    // Now preload the item AFTER the one we’re about to show
    preloadNext(mediaFiles[(index + 1) % mediaFiles.length]);

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
        scheduleNextSlide();
      }, 2000);
    }, () => {
      // If next media fails to load, skip to the next item.
      setTimeout(() => transitionToNext("media-load-failed"), 1000);
    });
  }


  function displayMedia(fileName, container, onReady, onFail) {
    container.innerHTML = "";
    const lower = fileName.toLowerCase();
    const isVideo = lower.endsWith(".mp4") || lower.endsWith(".webm");
    const url = `http://${serverIP}/slideshow/uploads/${encodeURIComponent(fileName)}`;

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

      const skip = (why) => {
        if (endedOrSkipped) return;
        endedOrSkipped = true;
        console.warn(`Skipping video "${fileName}": ${why}`);
        if (onFail) onFail();
      };

      video.addEventListener("error", () => skip("error loading/decoding"), { once: true });

      let stallTimer = null;
      const armStall = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => skip("stalled/buffering"), 7000);
      };
      video.addEventListener("waiting", armStall);
      video.addEventListener("stalled", armStall);
      video.addEventListener("playing", () => clearTimeout(stallTimer));

      video.addEventListener("ended", () => {
        clearTimeout(stallTimer);
        transitionToNext("video-ended");
      });

      video.load();

      // Try to play
      video.play().catch(() => {
      });

      // Only transition in after a real frame exists
      waitForFirstVideoFrame(video, () => {
        if (onReady) onReady();
        video.play().catch(() => skip("autoplay blocked"));
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

  // Start first slide + preload next
  preloadNext(mediaFiles[(index + 1) % mediaFiles.length]);
  displayMedia(mediaFiles[index], currentSlide, scheduleNextSlide);
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
      const defaultPage = localStorage.getItem("defaultPage") || "/dashboard";
      window.location.href = defaultPage;

    });
}

async function waitForPCAndMaybeMacro() {
  let attempts = 0;
  const maxAttempts = 40;
  const intervalMs = 3000;
  const defaultPage = localStorage.getItem("defaultPage") || "/dashboard";

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
