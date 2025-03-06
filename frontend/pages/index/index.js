const serverIP = CONFIG.SERVER_PC_IP;
let images = [];

fetch(`http://${serverIP}:5010/images`)
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
      currentImg.src = `http://${serverIP}:5010/uploads/${images[index]}`;
      currentImg.classList.add("slide-center");
      nextImg.classList.add("slide-right");

      setInterval(() => {
        index = (index + 1) % images.length;

        // Move in the next image from right -> center
        nextImg.classList.remove("slide-center", "slide-left");
        nextImg.classList.add("slide-right");
        nextImg.src = `http://${serverIP}:5010/uploads/${images[index]}`;
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

  document.body.addEventListener("dblclick", () => {
    console.log("Waking up PC...");

    fetch(`http://${serverIP}:5000/wake`, { method: "POST" })
        .then(response => response.json())
        .then(data => {
            console.log(data.status);

            setTimeout(() => {
                window.location.href = "/resources";
            }, 20000); 
        })
        .catch(error => {
            console.error("Failed to send WoL request:", error);
            window.location.href = "/resources"; // Redirect anyway
        });
});

