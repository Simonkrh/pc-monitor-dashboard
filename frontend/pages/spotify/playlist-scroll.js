let playlistContainer = document.querySelector(".playlist-container");

let isDragging = false;
let startYSS = 0;
let scrollTop = 0;

// Touch Events
playlistContainer.addEventListener("touchstart", (e) => {
    isDragging = true;
    startYS = e.touches[0].pageY - playlistContainer.offsetTop;
    scrollTop = playlistContainer.scrollTop;
}, { passive: true });

playlistContainer.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    let y = e.touches[0].pageY - playlistContainer.offsetTop;
    let move = (y - startYS) * -1.5; 
    playlistContainer.scrollTop = scrollTop + move;
}, { passive: true });

playlistContainer.addEventListener("touchend", () => {
    isDragging = false;
});

playlistContainer.addEventListener("mousedown", (e) => {
    isDragging = true;
    startYS = e.clientY;
    scrollTop = playlistContainer.scrollTop;
});

playlistContainer.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    let move = (e.clientY - startYS) * -1.5; 
    playlistContainer.scrollTop = scrollTop + move;
    e.preventDefault(); // Prevent unwanted selection
});

playlistContainer.addEventListener("mouseup", () => {
    isDragging = false;
    playlistContainer.style.cursor = "default";
});

// Prevent text selection while dragging
playlistContainer.addEventListener("mouseleave", () => {
    isDragging = false;
    playlistContainer.style.cursor = "default";
});
