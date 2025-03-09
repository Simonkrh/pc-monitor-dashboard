document.addEventListener("DOMContentLoaded", () => {
    const serverIP = CONFIG.SERVER_PC_IP;
    const form = document.getElementById("upload-form");
    const imageListDiv = document.getElementById("image-list");
    const returnBtn = document.getElementById("return");

    async function fetchImages() {
        try {
            const response = await fetch(`http://${serverIP}:5000/slideshow/images`);
            const images = await response.json();
            imageListDiv.innerHTML = ""; 
            images.forEach(image => {
                const imgElement = document.createElement("img");
                imgElement.src = `http://${serverIP}:5000/slideshow/uploads/${image}`;
                imgElement.style.width = "200px";
                imgElement.style.margin = "10px";
                imageListDiv.appendChild(imgElement);
            });
        } catch (error) {
            console.error("Error fetching images:", error);
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
    
        try {
            const response = await fetch(`http://${serverIP}:5000/slideshow/upload`, {
                method: "POST",
                body: formData
            });
    
            if (response.ok) {
                const result = await response.json();
                alert(result.message); 
                form.reset();
                fetchImages();
            } else {
                alert("Upload failed! Please try again.");
            }
        } catch (error) {
            console.error("Error uploading file(s):", error);
            alert("An error occurred while uploading.");
        }
    });
    

    returnBtn.addEventListener("click", () => {
        window.location.href = "/";
    });

    fetchImages();
});
