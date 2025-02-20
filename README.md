# PC Monitor Dashboard - Important Notes

## Project Overview

This project sets up a PC monitoring dashboard using:

- Glances on Window/Linux to collect system stats
- Flask (server.py) on Raspberry Pi as an API proxy
- Flask (webserver.py) to serve the frontend
- JavaScript (index.html) to display real-time stats

## Setup & Installation

### Installing Required Packages

#### On Window/Linux (Glances & Python)

`pip install glances`

`pip install fastapi uvicorn`

Start Glances:

`glances -w`

#### On Raspberry Pi (Flask & Flask-CORS)

`sudo apt update`

`sudo apt install python3-flask python3-flask-cors`

## Running the Servers Manually

### Start Glances on Window/Linux

`glances -w`

### Start API Server (server.py) on Raspberry Pi

`cd ~/pc-monitor-dashboard/backend`

`python3 server.py`

### Start Web Server (webserver.py) on Raspberry Pi

`cd ~/pc-monitor-dashboard/backend`

`python3 webserver.py`