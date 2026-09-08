from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.http import HttpHeaders
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

AUTH_TAG = "auth"


def _csrf_header_name() -> str:
    header_name = HttpHeaders.parse_header_name(settings.CSRF_HEADER_NAME)

    if header_name is None:
        raise ImproperlyConfigured(
            "CSRF_HEADER_NAME must use Django request.META header format."
        )

    return header_name.upper()


CSRF_HEADER_PARAMETER = OpenApiParameter(
    name=_csrf_header_name(),
    type=OpenApiTypes.STR,
    location=OpenApiParameter.HEADER,
    required=True,
    description=(
        "CSRF token corresponding to the "
        f"`{settings.CSRF_COOKIE_NAME}` cookie. "
        "Obtain the cookie from the CSRF bootstrap endpoint."
    ),
)
