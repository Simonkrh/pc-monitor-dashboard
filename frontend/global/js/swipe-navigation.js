let startX = 0;
let startY = 0;
let moveX = 0;
let moveY = 0;
const threshold = 300; // Minimum swipe distance

// Define the order of the pages
const pages = ["/dashboard", "/spotify", "/resources"];
const hiddenPages = JSON.parse(localStorage.getItem("hiddenPages")) || [];
const visiblePages = pages.filter((page) => !hiddenPages.includes(page));

if (visiblePages.length === 0) {
  visiblePages.push("/dashboard");
}
let currentPage = window.location.pathname;
let currentIndex = visiblePages.findIndex((page) => currentPage.includes(page.split('/').pop()));

if (currentIndex === -1) {
  currentIndex = 0;
}

// Ensure the new page fades in quickly
window.onload = () => {
  document.body.classList.add("show");
};

// Touch Events
document.addEventListener("touchstart", (event) => {
  startX = event.touches[0].clientX;
  startY = event.touches[0].clientY;
});

document.addEventListener("touchmove", (event) => {
  moveX = event.touches[0].clientX;
  moveY = event.touches[0].clientY;

  let diffX = Math.abs(moveX - startX);
  let diffY = Math.abs(moveY - startY);

  // Check if swiping inside the playlist
  let isSwipingPlaylist = event.target.closest(".playlist-container");

  // If swiping inside playlist, allow vertical scrolling but prevent page navigation swipe
  if (isSwipingPlaylist && diffY > diffX) {
    return;
  }

  // If horizontal swipe detected and not inside the playlist, prevent default for page navigation
  if (!isSwipingPlaylist && diffX > diffY && Math.abs(diffX) > 10) {
    event.preventDefault();
  }
}, { passive: false });

document.addEventListener("touchend", () => {
  handleSwipe();
});

// Mouse Events (for swiping with a mouse)
document.addEventListener("mousedown", (event) => {
  startX = event.clientX;
  startY = event.clientY;
});

document.addEventListener("mousemove", (event) => {
  moveX = event.clientX;
  moveY = event.clientY;
});

document.addEventListener("mouseup", () => {
  handleSwipe();
});

// Swipe Handling
function handleSwipe() {
  const diffX = moveX - startX;
  const diffY = moveY - startY;

  const absDiffX = Math.abs(diffX);
  const absDiffY = Math.abs(diffY);

  // Ignore taps (movement too small)
  if (absDiffX < threshold && absDiffY < threshold) return;

  // Horizontal swipe
  if (absDiffX > absDiffY && absDiffX > threshold) {
    if (diffX < 0) {
      navigateHorizontally("next"); // Swipe Left
    } else {
      navigateHorizontally("prev"); // Swipe Right
    }
  }

  // Vertical swipe
  else if (absDiffY > absDiffX && absDiffY > threshold) {
    const isSettingsPage = window.location.pathname.includes("/settings");

    if (diffY > 0 && !isSettingsPage) {
      // Swipe Down -> go to settings
      document.body.classList.add("swipe-down");
      setTimeout(() => {
        window.location.href = "/settings";
      }, 300);
    } else if (diffY < 0 && isSettingsPage) {
      // Swipe Up -> go to previous page
      document.body.classList.add("swipe-up");
      const previousPage = document.referrer || visiblePages[currentIndex] || "/dashboard";
      setTimeout(() => {
        window.location.href = previousPage;
      }, 300);
    }
  }
}


// Swipe Transition + Fade-in Effect on New Page
function navigateHorizontally(direction) {
  if (direction === "next") {
    document.body.classList.add("swipe-left");
    currentIndex = (currentIndex + 1) % visiblePages.length;
  } else {
    document.body.classList.add("swipe-right");
    currentIndex = (currentIndex - 1 + visiblePages.length) % visiblePages.length;
  }

  setTimeout(() => {
    window.location.href = visiblePages[currentIndex];
  }, 300);
}
