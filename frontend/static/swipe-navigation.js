let startX = 0;
let moveX = 0;
const threshold = 50; // Minimum swipe distance

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

// Swipe Handling (shared for both mouse & touch)
function handleSwipe() {
  const diffX = startX - moveX;

  if (diffX > threshold) {
    navigateToPage("next"); // Swipe Left
  } else if (diffX < -threshold) {
    navigateToPage("prev"); // Swipe Right
  }
}

// Page Navigation with Smooth Fade-Out
function navigateToPage(direction) {
  document.body.classList.add("fade-out");

  setTimeout(() => {
    if (direction === "next") {
      window.location.href = "/static/next-page.html";
    } else {
      window.location.href = "/static/previous-page.html";
    }
  }, 500);
}
