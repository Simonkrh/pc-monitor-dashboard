let startX = 0;
let startY = 0;
let moveX = 0;
let moveY = 0;
const threshold = 300; // Minimum swipe distance

// Define the order of the pages
const pages = ["/resources", "/spotify", "/dashboard"];
let currentPage = window.location.pathname;
let currentIndex = pages.findIndex((page) => currentPage.includes(page.split('/').pop()));

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
});

document.addEventListener("mousemove", (event) => {
  moveX = event.clientX;
});

document.addEventListener("mouseup", () => {
  handleSwipe();
});

// Swipe Handling
function handleSwipe() {
  const diffX = moveX - startX;
  const diffY = moveY - startY;

  // Ignore taps (when the movement is too small)
  if (Math.abs(diffX) < threshold || Math.abs(diffY) > threshold / 2) return;

  if (diffX < 0) {
    navigateToPage("next"); // Swipe Left
  } else {
    navigateToPage("prev"); // Swipe Right
  }
}


// Swipe Transition + Fade-in Effect on New Page
function navigateToPage(direction) {
  if (direction === "next") {
    document.body.classList.add("swipe-left");
    currentIndex = (currentIndex + 1) % pages.length;
  } else {
    document.body.classList.add("swipe-right");
    currentIndex = (currentIndex - 1 + pages.length) % pages.length;
  }

  setTimeout(() => {
    window.location.href = pages[currentIndex];
  }, 300);
}
