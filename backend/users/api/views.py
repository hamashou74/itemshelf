from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import CsrfRequiredSessionAuthentication
from .openapi import AUTH_TAG, CSRF_HEADER_PARAMETER
from .serializers import (
    CurrentUserSerializer,
    ErrorDetailSerializer,
    LoginSerializer,
)


@method_decorator(
    [ensure_csrf_cookie, never_cache],
    name="dispatch",
)
class CsrfView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(
        operation_id="auth_csrf",
        tags=[AUTH_TAG],
        auth=[],
        request=None,
        responses={
            status.HTTP_200_OK: OpenApiResponse(
                description="CSRF cookie initialized successfully.",
            ),
        },
    )
    def get(self, request: Request) -> Response:
        return Response(status=status.HTTP_200_OK)


@method_decorator([sensitive_post_parameters(), never_cache], name="dispatch")
class LoginView(APIView):
    authentication_classes = (CsrfRequiredSessionAuthentication,)
    permission_classes = (AllowAny,)
    parser_classes = (JSONParser,)

    @extend_schema(
        operation_id="auth_login",
        tags=[AUTH_TAG],
        auth=[],
        parameters=[CSRF_HEADER_PARAMETER],
        request=LoginSerializer,
        responses={
            status.HTTP_200_OK: OpenApiResponse(
                description="Authenticated session created successfully.",
            ),
            status.HTTP_400_BAD_REQUEST: OpenApiResponse(
                response=OpenApiTypes.OBJECT,
                description="Request or credential validation failed.",
            ),
            status.HTTP_403_FORBIDDEN: OpenApiResponse(
                response=ErrorDetailSerializer,
                description="CSRF validation failed.",
            ),
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: OpenApiResponse(
                response=ErrorDetailSerializer,
                description="The request Content-Type is not supported.",
            ),
        },
    )
    @sensitive_variables()
    def post(self, request: Request) -> Response:
        _request = request._request
        serializer = LoginSerializer(
            data=request.data,
            context={"request": _request},
        )
        serializer.is_valid(raise_exception=True)

        auth_login(_request, serializer.validated_data["user"])

        return Response(status=status.HTTP_200_OK)


class LogoutView(APIView):
    @extend_schema(
        operation_id="auth_logout",
        tags=[AUTH_TAG],
        parameters=[CSRF_HEADER_PARAMETER],
        request=None,
        responses={
            status.HTTP_200_OK: OpenApiResponse(
                description="Authenticated session terminated successfully.",
            ),
            status.HTTP_403_FORBIDDEN: OpenApiResponse(
                response=ErrorDetailSerializer,
                description="Authentication or CSRF validation failed.",
            ),
        },
    )
    def post(self, request: Request) -> Response:
        _request = request._request
        auth_logout(_request)

        return Response(status=status.HTTP_200_OK)


@method_decorator(never_cache, name="dispatch")
class CurrentUserView(APIView):
    @extend_schema(
        operation_id="auth_me",
        tags=[AUTH_TAG],
        responses={
            status.HTTP_200_OK: CurrentUserSerializer,
            status.HTTP_403_FORBIDDEN: OpenApiResponse(
                response=ErrorDetailSerializer,
                description="Authentication is required.",
            ),
        },
    )
    def get(self, request: Request) -> Response:
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)
