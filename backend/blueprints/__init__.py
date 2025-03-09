# Import all Blueprints so they can be registered in app.py
from .monitoring import monitoring
from .spotify import spotify
from .slideshow import slideshow

# List of available blueprints (optional, but useful)
__all__ = ["monitoring", "spotify", "slideshow"]
