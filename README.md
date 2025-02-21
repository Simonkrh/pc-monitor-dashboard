# PC Monitor Dashboard - Important Notes

## Project Overview

This project sets up a PC monitoring dashboard using:

- Glances on Window/Linux to collect system stats
- Flask (server.py) on Raspberry Pi as an API proxy
- Flask (webserver.py) to serve the frontend
- JavaScript (index.html) to display real-time stats

## Setup & Installation

### Installing Required Packages

## Open Hardware Monitor for resouce utilization API
https://openhardwaremonitor.org/

### Start API Server (server.py) on Raspberry Pi

`cd ~/pc-monitor-dashboard/backend`

`python3 server.py`

### Start Web Server (webserver.py) on Raspberry Pi

`cd ~/pc-monitor-dashboard/backend`

`python3 webserver.py`
