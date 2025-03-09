const serverIP = `${CONFIG.SERVER_PC_IP}`;
let images = [];

fetch(`http://${serverIP}/slideshow/images`)
  .then(response => response.json())
  .then(data => {
    images = data;
    if (images.length > 0) {
      let index = Math.floor(Math.random() * images.length);

      const img1 = document.getElementById("image1");
      const img2 = document.getElementById("image2");

      let currentImg = img1;
      let nextImg = img2;

      // Show first image
      currentImg.src = `http://${serverIP}/slideshow/uploads/${images[index]}`;
      currentImg.classList.add("slide-center");
      nextImg.classList.add("slide-right");

      setInterval(() => {
        index = (index + 1) % images.length;

        // Move in the next image from right -> center
        nextImg.classList.remove("slide-center", "slide-left");
        nextImg.classList.add("slide-right");
        nextImg.src = `http://${serverIP}/slideshow/uploads/${images[index]}`;
        nextImg.offsetHeight; // Force reflow
        nextImg.classList.remove("slide-right");
        nextImg.classList.add("slide-center");

        // Move the old image center -> left
        currentImg.classList.remove("slide-center");
        currentImg.classList.add("slide-left");

        setTimeout(() => {
          // Snap old image instantly from left -> right (offscreen)
          currentImg.style.transition = "none";
          currentImg.classList.remove("slide-left", "slide-center");
          currentImg.classList.add("slide-right");
          currentImg.offsetHeight; // Force reflow
          currentImg.style.transition = "";
          
          [currentImg, nextImg] = [nextImg, currentImg];
        }, 2000); 

      }, 7000);
    }
  })
  .catch(err => console.error(err));

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