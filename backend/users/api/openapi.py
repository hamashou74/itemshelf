from django.conf import settings
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

AUTH_TAG = "auth"


def _csrf_header_name() -> str:
    header_name = settings.CSRF_HEADER_NAME

    header_name = header_name.removeprefix("HTTP_")

    return header_name.replace("_", "-")


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
