import os
from pathlib import Path

import dotenv

base_dir = Path(__file__).resolve().parent.parent
env_file = base_dir / ".env"
if env_file.exists():
    dotenv.load_dotenv(env_file)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

from django.core.asgi import get_asgi_application

application = get_asgi_application()
