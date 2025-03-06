document.addEventListener("DOMContentLoaded", () => {
    const serverIP = CONFIG.SERVER_PC_IP;
    const form = document.getElementById("upload-form");
    const imageListDiv = document.getElementById("image-list");
    const returnBtn = document.getElementById("return");

    async function fetchImages() {
        try {
            const response = await fetch(`http://${serverIP}:5010/images`);
            const images = await response.json();
            imageListDiv.innerHTML = ""; 
            images.forEach(image => {
                const imgElement = document.createElement("img");
                imgElement.src = `http://${serverIP}:5010/uploads/${image}`;
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
            const response = await fetch(`http://${serverIP}:5010/upload`, {
                method: "POST",
                body: formData
            });

            if (response.ok) {
                alert("File uploaded successfully!");
                form.reset();
                fetchImages(); 
            } else {
                alert("Upload failed! Please try again.");
            }
        } catch (error) {
            console.error("Error uploading file:", error);
            alert("An error occurred while uploading.");
        }
    });

    returnBtn.addEventListener("click", () => {
        window.location.href = "/";
    });

    fetchImages();
});
