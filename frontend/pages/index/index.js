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


fetch(`http://${serverIP}/slideshow/media`)
  .then((response) => response.json())
  .then((data) => {
    mediaFiles = data;
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

  displayMedia(mediaFiles[index], currentSlide);
  scheduleNextSlide();

  function scheduleNextSlide() {
    const currentMedia = currentSlide.querySelector("img, video");
    if (currentMedia && currentMedia.tagName.toLowerCase() === "img") {
      setTimeout(() => transitionToNext(), 7000);
    }
  }

  function transitionToNext() {
    index = (index + 1) % mediaFiles.length;

    nextSlide.classList.remove("slide-center", "slide-left");
    nextSlide.classList.add("slide-right");
    
    displayMedia(mediaFiles[index], nextSlide);

    nextSlide.offsetHeight; 

    // Slide nextSlide in from right -> center
    nextSlide.classList.remove("slide-right");
    nextSlide.classList.add("slide-center");

    // Slide currentSlide from center -> left
    currentSlide.classList.remove("slide-center");
    currentSlide.classList.add("slide-left");

    setTimeout(() => {
      currentSlide.style.transition = "none";
      currentSlide.classList.remove("slide-left", "slide-center", "slide-right");
      currentSlide.classList.add("slide-right");
      currentSlide.innerHTML = ""; 
      currentSlide.offsetHeight;    
      currentSlide.style.transition = "";

      // Swap references
      [currentSlide, nextSlide] = [nextSlide, currentSlide];

      scheduleNextSlide();
    }, 2000); 
  }

  function displayMedia(fileName, container) {
    container.innerHTML = "";

    const lower = fileName.toLowerCase();
    const isVideo = lower.endsWith(".mp4") || lower.endsWith(".webm");

    if (isVideo) {
      const video = document.createElement("video");
      video.src = `http://${serverIP}/slideshow/uploads/${fileName}`;
      video.autoplay = true;
      video.playsInline = true; 
  
      video.addEventListener("ended", () => {
        transitionToNext();
      });

      container.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = `http://${serverIP}/slideshow/uploads/${fileName}`;
      container.appendChild(img);
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