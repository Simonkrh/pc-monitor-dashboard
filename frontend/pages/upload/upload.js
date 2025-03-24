document.addEventListener("DOMContentLoaded", () => {
    const serverIP = `http://${CONFIG.SERVER_PC_IP}/slideshow`;

    const form = document.getElementById("upload-form");
    const imageListDiv = document.getElementById("image-list");
    const returnBtn = document.getElementById("return");

    async function fetchImages() {
        try {
            const response = await fetch(`${serverIP}/media`);
            const text = await response.text();
            console.log("Raw response from /media:", text);

            let images;
            try {
            images = JSON.parse(text);
            } catch (e) {
            console.error("Failed to parse JSON!", e);
            return;
            }
            imageListDiv.innerHTML = "";
            images.forEach(file => {
                const ext = file.split('.').pop().toLowerCase();
                const fileUrl = `${serverIP}/uploads/${file}`;
            
                let mediaElement;
            
                if (["mp4", "webm", "ogg"].includes(ext)) {
                    mediaElement = document.createElement("video");
                    mediaElement.src = fileUrl;
                    mediaElement.controls = true;
                    mediaElement.muted = true;
                } else {
                    mediaElement = document.createElement("img");
                    mediaElement.src = fileUrl;
                }
            
                mediaElement.style.width = "200px";
                mediaElement.style.margin = "10px";
                imageListDiv.appendChild(mediaElement);
            });            
        } catch (error) {
            console.error("Error fetching media:", error);
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);

        try {
            const response = await fetch(`${serverIP}/upload`, {
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
