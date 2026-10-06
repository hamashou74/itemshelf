import environ

from .base import *

env = environ.Env()

DEBUG = False

# Public requests must reach Django through a trusted TLS-terminating ingress.
# The ingress must remove any client-supplied X-Forwarded-Proto value and set
# the header from the actual external connection before forwarding the request.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# HTTPS redirect and HSTS are ingress responsibilities. Trusted private
# service-to-service traffic may use HTTP, so Django must not redirect it.
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0

# Keep Django-issued session and CSRF credentials HTTPS-only if they are ever
# transported by a browser-facing deployment path.
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# The public ingress owns these two controls. Other deployment warnings remain
# unsilenced so `manage.py check --deploy --fail-level WARNING` stays strict.
SILENCED_SYSTEM_CHECKS = [
    "security.W004",
    "security.W008",
]

SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

DATABASES = {
    "default": env.db(),
}
