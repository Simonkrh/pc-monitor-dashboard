let startX = 0;
let startY = 0;
let moveX = 0;
let moveY = 0;
const threshold = 50; // Minimum swipe distance

// Define the order of the pages
const pages = ["/static/index.html", "/static/spotify.html", "/static/macro.html"];
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

  // Only prevent scrolling if horizontal movement is larger than vertical movement
  if (diffX > diffY) {
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
  const diffX = startX - moveX;

  if (Math.abs(diffX) < threshold) return; // Ignore small movements

  if (diffX > 0) {
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
  }, 250);
}
