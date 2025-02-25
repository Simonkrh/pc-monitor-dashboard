let startX = 0;
let moveX = 0;
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
});

document.addEventListener("touchmove", (event) => {
  event.preventDefault();
  moveX = event.touches[0].clientX;
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

  if (diffX > threshold) {
    navigateToPage("next"); // Swipe Left
  } else if (diffX < -threshold) {
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
