from pathlib import Path

import environ

from .base import *  # noqa: F403
from .base import BASE_DIR


env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env.development")

DEBUG = True

SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

DATABASES = {
    "default": env.db(),
}

database = DATABASES["default"]
if database["ENGINE"] == "django.db.backends.sqlite3":
    database_name = database["NAME"]
    if database_name != ":memory:":
        database_path = Path(str(database_name))
        if not database_path.is_absolute():
            database["NAME"] = BASE_DIR / database_path

MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.console.EmailBackend",
    },
}
