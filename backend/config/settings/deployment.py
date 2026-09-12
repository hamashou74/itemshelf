import environ

from .base import *

env = environ.Env()

DEBUG = False

# The backend is not browser-facing in deployment. Next.js reaches Django only
# over Railway's WireGuard-encrypted private HTTP network, so browser HTTPS and
# Secure-cookie transport checks do not apply to this service boundary.
SILENCED_SYSTEM_CHECKS = [
    "security.W004",
    "security.W008",
    "security.W012",
    "security.W016",
]

SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

DATABASES = {
    "default": env.db(),
}
