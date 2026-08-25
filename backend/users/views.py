from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import CsrfRequiredSessionAuthentication
from .serializers import CurrentUserSerializer, LoginSerializer


@method_decorator(
    [ensure_csrf_cookie, never_cache],
    name="dispatch",
)
class CsrfView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        return Response(status=status.HTTP_200_OK)


@method_decorator([sensitive_post_parameters(), never_cache], name="dispatch")
class LoginView(APIView):
    authentication_classes = [CsrfRequiredSessionAuthentication]
    permission_classes = [AllowAny]

    @sensitive_variables()
    def post(self, request: Request) -> Response:
        _request = request._request
        serializer = LoginSerializer(data=request.data, context={"request": _request})
        serializer.is_valid(raise_exception=True)

        auth_login(_request, serializer.validated_data["user"])

        return Response(status=status.HTTP_200_OK)


class LogoutView(APIView):
    def post(self, request: Request) -> Response:
        _request = request._request
        auth_logout(_request)

        return Response(status=status.HTTP_200_OK)


@method_decorator(never_cache, name="dispatch")
class CurrentUserView(APIView):
    def get(self, request: Request) -> Response:
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)
