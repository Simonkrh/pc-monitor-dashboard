const blockClicksMS = 300;
let playlistContainer = document.querySelector(".playlist-container");

let isDragging = false;
let startYS = 0;
let scrollTop = 0;

let oldScrollTop = 0;
let velocity = 0;
let momentumID = null; // for canceling requestAnimationFrame

playlistContainer.addEventListener("touchstart", (e) => {
  isDragging = true;
  cancelMomentumScroll();

  // Store initial positions
  startYS = e.touches[0].pageY - playlistContainer.offsetTop;
  scrollTop = playlistContainer.scrollTop;
  oldScrollTop = scrollTop;
}, { passive: true });

playlistContainer.addEventListener("touchmove", (e) => {
  if (!isDragging) return;

  let y = e.touches[0].pageY - playlistContainer.offsetTop;
  let move = (y - startYS) * -1.5;
  playlistContainer.scrollTop = scrollTop + move;

  // Calculate velocity as the difference since last frame
  velocity = playlistContainer.scrollTop - oldScrollTop;
  oldScrollTop = playlistContainer.scrollTop;
}, { passive: true });

playlistContainer.addEventListener("touchend", () => {
  isDragging = false;
  startMomentumScroll();
});

playlistContainer.addEventListener("mousedown", (e) => {
  isDragging = true;
  cancelMomentumScroll();

  startYS = e.clientY;
  scrollTop = playlistContainer.scrollTop;
  oldScrollTop = scrollTop;
});

playlistContainer.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  let move = (e.clientY - startYS) * -1.5;
  playlistContainer.scrollTop = scrollTop + move;
  e.preventDefault(); // Prevent text selection

  // Velocity
  velocity = playlistContainer.scrollTop - oldScrollTop;
  oldScrollTop = playlistContainer.scrollTop;
});

playlistContainer.addEventListener("mouseup", () => {
  isDragging = false;
  startMomentumScroll();
});

// Stop dragging if the mouse leaves the container
playlistContainer.addEventListener("mouseleave", () => {
  isDragging = false;
  startMomentumScroll();
});

function startMomentumScroll() {
  // If velocity is almost zero, stop
  if (Math.abs(velocity) < 0.5) return;

  playlistContainer.scrollTop += velocity;
  velocity *= 0.95; // friction

  momentumID = requestAnimationFrame(startMomentumScroll);
  blockClicksFor(blockClicksMS);
}

function cancelMomentumScroll() {
  if (momentumID) {
    cancelAnimationFrame(momentumID);
    momentumID = null;
  }
}
