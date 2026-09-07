from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.csrf import csrf_failure as default_csrf_failure


def csrf_failure(
    request: HttpRequest,
    reason: str = "",
) -> HttpResponse:
    if request.path.startswith("/api/"):
        return JsonResponse(
            {"detail": "CSRF validation failed."},
            status=403,
        )

    return default_csrf_failure(
        request,
        reason=reason,
    )
