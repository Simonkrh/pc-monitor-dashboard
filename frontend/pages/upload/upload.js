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
    
        const files = form.querySelector('input[type="file"]').files;
        if (files.length === 0) {
            alert("No files selected!");
            return;
        }
    
        const statusText = document.getElementById("upload-text");
        const progressBar = document.getElementById("upload-progress");
    
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append("file", file);
    
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", `${serverIP}/upload`);
    
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 100;
                        progressBar.value = percent;
                        statusText.textContent = `Uploading ${file.name} (${i + 1}/${files.length})... ${Math.round(percent)}%`;
                    }
                };
    
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        resolve();
                    } else {
                        reject(new Error("Upload failed"));
                    }
                };
    
                xhr.onerror = () => reject(new Error("Upload error"));
                xhr.send(formData);
            });
        }
    
        statusText.textContent = "All files uploaded!";
        progressBar.value = 100;
        form.reset();
        fetchImages();
    });
    

    returnBtn.addEventListener("click", () => {
        window.location.href = "/";
    });

    fetchImages();
});
