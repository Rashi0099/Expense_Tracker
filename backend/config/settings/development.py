from .base import *

DEBUG = os.environ.get("DEBUG", "True").lower() in ("true", "1", "yes")

# CORS allowed origins for React Web local development
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

CORS_ALLOW_CREDENTIALS = True
