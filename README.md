# PC Monitor Dashboard - Important Notes

## Project Overview

This project sets up a PC monitoring dashboard using:

- Open Hardware Monitor to collect system stats
- Glances to collect network stats
- Flask (server.py) on Raspberry Pi as an API proxy
- Flask (webserver.py) to serve the frontend
- JavaScript (index.html) to display real-time stats

## Setup & Installation

### Installing Required Packages

- Open Hardware Monitor for resouce utilization API

  https://openhardwaremonitor.org/

- Glances for Network utilization API

  `pip install glances`

  `pip install fastapi uvicorn`

