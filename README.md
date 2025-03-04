# PC Monitor Dashboard - Important Notes

## Project Overview

This project sets up a PC monitoring dashboard using:

- **Open Hardware Monitor** to collect system stats
- **Glances** to collect network stats
- **Spotify Integration** for controlling and displaying currently playing songs
- **Flask (monitoring_server.py)** on as an API proxy
- **Flask (spotifyserver.py)** to handle Spotify API requests
- **Flask (webserver.py)** to serve the frontend

## Configs
### Set Up the Required .env File
Create a `.env` file in the **root folder** with the following structure:
```
SPOTIFY_CLIENT_ID=""
SPOTIFY_CLIENT_SECRET=""
SPOTIFY_REFRESH_TOKEN=""

MONITORED_PC_IP=""  # The PC being monitored (OHM & Glances)
SERVER_PC_IP=""      # The PC running the backend servers
```

### Configuring `config.js`
The frontend uses a **`config.js`** file to store the server IP.  
Create a `config.js` file inside the **frontend folder** with the following content:
```js
const CONFIG = {
    SERVER_PC_IP: "",  // Replace with your actual server IP
};