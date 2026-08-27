from django.conf import settings
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import User

CSRF_URL = "/api/auth/csrf"
LOGIN_URL = "/api/auth/login"
LOGOUT_URL = "/api/auth/logout"
FRONTEND_ORIGIN = "http://localhost:3000"


class FrontendProxyCsrfTests(TestCase):
    username = "testuser"
    password = "correct-password"  # noqa: S105

    def setUp(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username=self.username,
            password=self.password,
        )

    def _csrf_token(self) -> str:
        return self.client.cookies[settings.CSRF_COOKIE_NAME].value

    def test_frontend_origin_can_login_and_logout_with_csrf(self) -> None:
        csrf_response = self.client.get(CSRF_URL)
        self.assertEqual(csrf_response.status_code, status.HTTP_200_OK)

        login_response = self.client.post(
            LOGIN_URL,
            {
                "username": self.username,
                "password": self.password,
            },
            format="json",
            HTTP_ORIGIN=FRONTEND_ORIGIN,
            HTTP_X_CSRFTOKEN=self._csrf_token(),
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        logout_response = self.client.post(
            LOGOUT_URL,
            HTTP_ORIGIN=FRONTEND_ORIGIN,
            HTTP_X_CSRFTOKEN=self._csrf_token(),
        )
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
