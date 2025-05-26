const serverIP = `${CONFIG.SERVER_PC_IP}`;
let images = [];

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
    document.body.style.filter = "brightness(25%)";
  }
  // Restore brightness if PC is on OR it's after 11:00 
  else {
    // console.log("PC is up or it's past 11:00. Restoring brightness...");
    document.body.style.filter = "brightness(100%)";
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

function startSlideshow() {
  let index = Math.floor(Math.random() * mediaFiles.length);

  const slide1 = document.getElementById("slide1");
  const slide2 = document.getElementById("slide2");

  let currentSlide = slide1;
  let nextSlide = slide2;

  displayMedia(mediaFiles[index], currentSlide, () => {
    scheduleNextSlide(); // Only schedule once image or video is visible
  });

  function scheduleNextSlide() {
    const currentMedia = currentSlide.querySelector("img, video");
    if (!currentMedia) return;

    if (currentMedia.tagName.toLowerCase() === "img") {
      setTimeout(() => transitionToNext(), 7000);
    }
    // Videos already handle `ended` event
  }

  function transitionToNext() {
    index = index + 1;
    if (index >= mediaFiles.length) {
      mediaFiles = shuffleArray(mediaFiles);
      index = 0;
    }

    nextSlide.classList.remove("slide-center", "slide-left");
    nextSlide.classList.add("slide-right");

    // Wait for the media to load before doing the transition
    displayMedia(mediaFiles[index], nextSlide, () => {
      nextSlide.offsetHeight; 

      // Slide nextSlide in from right -> center
      nextSlide.classList.remove("slide-right");
      nextSlide.classList.add("slide-center");

      // Slide currentSlide from center -> left
      currentSlide.classList.remove("slide-center");
      currentSlide.classList.add("slide-left");

      // After animation completes (2s), reset and swap slides
      setTimeout(() => {
        currentSlide.style.transition = "none";
        currentSlide.classList.remove("slide-left", "slide-center", "slide-right");
        currentSlide.classList.add("slide-right");
        currentSlide.innerHTML = ""; 
        currentSlide.offsetHeight; 
        currentSlide.style.transition = "";

        // Swap slides
        [currentSlide, nextSlide] = [nextSlide, currentSlide];

        scheduleNextSlide();
      }, 2000);
    });
  }

  function displayMedia(fileName, container, onLoaded) {
    container.innerHTML = "";
    const lower = fileName.toLowerCase();
    const isVideo = lower.endsWith(".mp4") || lower.endsWith(".webm");

    if (isVideo) {
      const video = document.createElement("video");
      video.src = `http://${serverIP}/slideshow/uploads/${fileName}`;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.loop = false;

      container.appendChild(video);

      let hasStarted = false;
      video.onplaying = () => {
        hasStarted = true;
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
      };

      let fallbackTimeout = null;

      video.onloadedmetadata = () => {
        fallbackTimeout = setTimeout(() => {
          if (!hasStarted) {
            console.warn(`Video "${fileName}" didn't start playing — skipping...`);
            transitionToNext();
          }
        }, 5000);
      };

      video.onloadeddata = () => {
        if (onLoaded) onLoaded();
      };

      video.onerror = () => {
        console.error(`Failed to load video: ${fileName}`);
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        transitionToNext(); 
      };

      video.addEventListener("ended", () => {
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        transitionToNext();
      });

      video.play().catch(err => {
        console.error("Autoplay failed:", err);
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        transitionToNext();
      });

    } else {
      const img = document.createElement("img");
      img.src = `http://${serverIP}/slideshow/uploads/${fileName}`;
      container.appendChild(img);

      img.onload = () => {
        if (onLoaded) onLoaded();
      };
      img.onerror = () => {
        console.error(`Failed to load image: ${fileName}`);
        transitionToNext();
      };
    }
  }
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
      waitForOpenHardwareMonitor();
    })
    .catch(error => {
      console.error("Failed to send WoL request:", error);
      window.location.href = "/resources";
    });
}

function waitForOpenHardwareMonitor() {
  let attempts = 0;
  const maxAttempts = 30;
  const checkInterval = 3000;

  const checkStatus = () => {
    fetch(`http://${serverIP}/monitoring/stats`)
      .then(response => response.json())
      .then(data => {
        if (data.cpu_usage && data.cpu_temp) {
          console.log("Open Hardware Monitor is responding!");
          window.location.href = "/resources";
        } else {
          throw new Error("Invalid data received");
        }
      })
      .catch(() => {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Waiting for Open Hardware Monitor... (${attempts}/${maxAttempts})`);
          setTimeout(checkStatus, checkInterval);
        } else {
          console.log("Timed out waiting for Open Hardware Monitor, redirecting anyway.");
          window.location.href = "/resources";
        }
      });
  };

  checkStatus();
}