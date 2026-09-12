from django.db import DatabaseError, connection
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.csrf import csrf_failure as default_csrf_failure
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(exclude=True)
    def get(self, _request: Request) -> Response:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except DatabaseError:
            return Response(
                {"status": "unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"status": "ok"},
            status=status.HTTP_200_OK,
        )


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
