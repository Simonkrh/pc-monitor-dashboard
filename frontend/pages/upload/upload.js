document.addEventListener("DOMContentLoaded", () => {
    const serverIP = `http://${CONFIG.SERVER_PC_IP}/slideshow`;

    const form = document.getElementById("upload-form");
    const imageListDiv = document.getElementById("image-list");
    const returnBtn = document.getElementById("return");

    async function fetchImages() {
        try {
            const response = await fetch(`${serverIP}/media`);
            const text = await response.text();
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
    
                const container = document.createElement("div");
                container.className = "media-container";
                container.dataset.filename = file;
    
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
    
                mediaElement.className = "media-preview";
    
                const label = document.createElement("div");
                label.textContent = file;
                label.className = "media-label";
    
                container.appendChild(mediaElement);
                container.appendChild(label);
    
                // Toggle selection on click
                container.addEventListener("click", () => {
                    container.classList.toggle("selected");
                });
    
                imageListDiv.appendChild(container);
            });
    
        } catch (error) {
            console.error("Error fetching media:", error);
        }
    }
    
    document.getElementById("delete-selected").addEventListener("click", async () => {
        const selectedContainers = document.querySelectorAll(".media-container.selected");
        if (selectedContainers.length === 0) {
            alert("No files selected!");
            return;
        }
    
        const confirmed = confirm(`Are you sure you want to delete ${selectedContainers.length} file(s)?`);
        if (!confirmed) return;
    
        const filenames = Array.from(selectedContainers).map(div => div.dataset.filename);
    
        const res = await fetch(`${serverIP}/delete-multiple`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: filenames })
        });
    
        if (res.ok) {
            fetchImages();
        } else {
            alert("Failed to delete selected files.");
        }
    });    

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
            const hash = await calculateFileHash(file);
        
            // Check with backend if file is duplicate
            const res = await fetch(`${serverIP}/check-hash`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hash }),
            });
            const result = await res.json();
        
            if (result.duplicate) {
                statusText.textContent = `Duplicate skipped: ${file.name} (${i + 1}/${files.length})`;
                continue; // skip this file
            }
        
            // Upload if the file is not a duplicate
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
        
                xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error("Upload failed"));
                xhr.onerror = () => reject(new Error("Upload error"));
                xhr.send(formData);
            });
        }
    
        statusText.textContent = "All files uploaded!";
        progressBar.value = 100;
        form.reset();
        fetchImages();
    });
    
    async function calculateFileHash(file) {
        const buffer = await file.arrayBuffer();
        const hashHex = sha256(new Uint8Array(buffer));
        return hashHex;
    }    
    
    returnBtn.addEventListener("click", () => {
        window.location.href = "/";
    });

    fetchImages();
});
