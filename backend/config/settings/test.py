import environ

from .base import *  # noqa: F403
from .base import BASE_DIR


env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env.test")

DEBUG = False

SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

DATABASES = {
    "default": env.db(),
}

MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    },
}
