document.addEventListener("DOMContentLoaded", () => {
    const serverIP = `http://${CONFIG.SERVER_PC_IP}/slideshow`;

    const form = document.getElementById("upload-form");
    const imageListDiv = document.getElementById("image-list");
    const returnBtn = document.getElementById("return");
    const searchInput = document.getElementById("media-search");
    const pageSizeSelect = document.getElementById("media-page-size");
    const pageInfo = document.getElementById("page-info");
    const prevPageBtn = document.getElementById("prev-page");
    const nextPageBtn = document.getElementById("next-page");
    const mediaSummary = document.getElementById("media-summary");
    const optimizeVideosCheckbox = document.getElementById("optimize-videos");

    let allMedia = [];
    let filteredMedia = [];
    let currentPage = 1;
    let activeVideo = null;

    function isVideoFile(fileName) {
        const ext = fileName.split(".").pop().toLowerCase();
        return ["mp4", "webm", "ogg"].includes(ext);
    }

    function getMediaUrl(fileName) {
        return `${serverIP}/uploads/${encodeURIComponent(fileName)}`;
    }

    function getThumbnailUrl(fileName) {
        return `${serverIP}/thumbnail/${encodeURIComponent(fileName)}`;
    }

    function getPageSize() {
        return Number(pageSizeSelect.value) || 24;
    }

    function stopActiveVideo() {
        if (!activeVideo) return;

        try {
            activeVideo.video.pause();
            activeVideo.video.removeAttribute("src");
            activeVideo.video.load();
        } catch { }

        if (activeVideo.resetPreview) {
            activeVideo.resetPreview();
        }

        activeVideo = null;
    }

    function applyFilters() {
        const query = searchInput.value.trim().toLowerCase();
        filteredMedia = query
            ? allMedia.filter(file => file.toLowerCase().includes(query))
            : allMedia.slice();
    }

    function renderVideoThumbnail(file, container, preview) {
        preview.innerHTML = "";
        preview.classList.add("video-preview-shell");
        preview.classList.remove("thumbnail-missing", "is-playing");

        const img = document.createElement("img");
        img.src = getThumbnailUrl(file);
        img.className = "media-preview";
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.onerror = () => {
            preview.classList.add("thumbnail-missing");
        };

        const fallback = document.createElement("div");
        fallback.className = "video-fallback";
        fallback.textContent = "Video";

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "play-video";
        playBtn.setAttribute("aria-label", `Play ${file}`);
        playBtn.title = "Play";
        playBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            playVideo(file, container, preview);
        });

        preview.appendChild(img);
        preview.appendChild(fallback);
        preview.appendChild(playBtn);
    }

    function playVideo(file, container, preview) {
        if (activeVideo) {
            stopActiveVideo();
        }

        preview.innerHTML = "";
        preview.classList.remove("thumbnail-missing");
        preview.classList.add("video-preview-shell", "is-playing");

        const video = document.createElement("video");
        video.className = "media-video";
        video.controls = true;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.src = getMediaUrl(file);

        video.addEventListener("click", event => event.stopPropagation());
        video.addEventListener("pointerdown", event => event.stopPropagation());

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "stop-video";
        closeBtn.setAttribute("aria-label", `Close ${file}`);
        closeBtn.title = "Close";
        closeBtn.textContent = "x";
        closeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            stopActiveVideo();
        });

        preview.appendChild(video);
        preview.appendChild(closeBtn);

        activeVideo = {
            video,
            resetPreview: () => {
                preview.classList.remove("is-playing");
                renderVideoThumbnail(file, container, preview);
            }
        };

        video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => { });
        });
    }

    function createMediaCard(file) {
        const container = document.createElement("div");
        container.className = "media-container";
        container.dataset.filename = file;

        const preview = document.createElement("div");
        preview.className = "media-preview-shell";

        if (isVideoFile(file)) {
            renderVideoThumbnail(file, container, preview);
        } else {
            const img = document.createElement("img");
            img.src = getMediaUrl(file);
            img.className = "media-preview";
            img.alt = "";
            img.loading = "lazy";
            img.decoding = "async";
            preview.appendChild(img);
        }

        const label = document.createElement("div");
        label.textContent = file;
        label.className = "media-label";

        container.appendChild(preview);
        container.appendChild(label);

        container.addEventListener("click", () => {
            container.classList.toggle("selected");
        });

        return container;
    }

    function renderMedia() {
        stopActiveVideo();
        applyFilters();

        const pageSize = getPageSize();
        const totalPages = Math.max(1, Math.ceil(filteredMedia.length / pageSize));
        currentPage = Math.min(Math.max(currentPage, 1), totalPages);

        const start = (currentPage - 1) * pageSize;
        const pageItems = filteredMedia.slice(start, start + pageSize);

        imageListDiv.innerHTML = "";

        if (pageItems.length === 0) {
            const empty = document.createElement("div");
            empty.className = "media-empty";
            empty.textContent = allMedia.length === 0 ? "No media uploaded." : "No matches.";
            imageListDiv.appendChild(empty);
        } else {
            pageItems.forEach(file => imageListDiv.appendChild(createMediaCard(file)));
        }

        pageInfo.textContent = `${currentPage} / ${totalPages}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;

        const totalText = `${filteredMedia.length} of ${allMedia.length}`;
        mediaSummary.textContent = `${totalText} media`;
    }

    async function fetchImages() {
        try {
            const response = await fetch(`${serverIP}/media`);
            const text = await response.text();
            try {
                allMedia = JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse JSON!", e);
                return;
            }

            renderMedia();
        } catch (error) {
            console.error("Error fetching media:", error);
        }
    }

    searchInput.addEventListener("input", () => {
        currentPage = 1;
        renderMedia();
    });

    pageSizeSelect.addEventListener("change", () => {
        currentPage = 1;
        renderMedia();
    });

    prevPageBtn.addEventListener("click", () => {
        currentPage--;
        renderMedia();
    });

    nextPageBtn.addEventListener("click", () => {
        currentPage++;
        renderMedia();
    });

    document.getElementById("delete-selected").addEventListener("click", async () => {
        const selectedContainers = document.querySelectorAll(".media-container.selected");
        if (selectedContainers.length === 0) {
            alert("No files selected!");
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete ${selectedContainers.length} file(s)?`);
        if (!confirmed) return;

        const filenames = Array.from(selectedContainers).map(div => div.dataset.filename);

        stopActiveVideo();

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
        const optimizeVideos = optimizeVideosCheckbox.checked;

        let duplicateCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const hash = await calculateFileHash(file);
            const ext = file.name.split(".").pop().toLowerCase();
            const isVideo = ["mp4", "webm", "mov", "mkv", "avi"].includes(ext);

            const res = await fetch(`${serverIP}/check-hash`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hash }),
            });
            const result = await res.json();

            if (result.duplicate) {
                duplicateCount++;
                statusText.textContent = `Duplicate skipped: ${file.name} (${i + 1}/${files.length})`;
                continue;
            }

            const formData = new FormData();
            formData.append("file", file);
            formData.append("optimize_videos", optimizeVideos ? "true" : "false");

            try {
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

                    xhr.upload.onload = () => {
                        statusText.textContent = isVideo
                            ? optimizeVideos
                                ? `Optimizing ${file.name} for the dashboard (${i + 1}/${files.length})...`
                                : `Saving ${file.name} without optimization (${i + 1}/${files.length})...`
                            : `Saving ${file.name} (${i + 1}/${files.length})...`;
                    };

                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            resolve();
                            return;
                        }

                        let message = "Upload failed";
                        try {
                            const error = JSON.parse(xhr.responseText);
                            message = error.details || error.error || message;
                        } catch { }
                        reject(new Error(message));
                    };
                    xhr.onerror = () => reject(new Error("Upload error"));
                    xhr.send(formData);
                });
            } catch (error) {
                statusText.textContent = `Failed to upload ${file.name}: ${error.message}`;
                alert(`Failed to upload ${file.name}:\n${error.message}`);
                return;
            }
        }

        statusText.textContent = `All files uploaded!${duplicateCount > 0 ? ` (${duplicateCount} duplicate${duplicateCount > 1 ? "s" : ""} skipped)` : ""}`;
        progressBar.value = 100;
        form.reset();
        currentPage = 1;
        fetchImages();
    });

    async function calculateFileHash(file) {
        const buffer = await file.arrayBuffer();
        const hashHex = sha256(new Uint8Array(buffer));
        return hashHex;
    }

    returnBtn.addEventListener("click", () => {
        window.location.href = "/settings";
    });

    fetchImages();
});
