from django.conf import settings
from django.contrib.auth import SESSION_KEY
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import User

CSRF_URL = "/api/auth/csrf"
LOGIN_URL = "/api/auth/login"
LOGOUT_URL = "/api/auth/logout"
ME_URL = "/api/auth/me"


class SessionAuthenticationTests(TestCase):
    username = "testuser"
    password = "correct-password"

    def setUp(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username=self.username,
            password=self.password,
        )

    def _csrf_token(self) -> str:
        return self.client.cookies[settings.CSRF_COOKIE_NAME].value

    def _bootstrap_csrf(self) -> str:
        response = self.client.get(CSRF_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(
            settings.CSRF_COOKIE_NAME,
            self.client.cookies,
        )

        return self._csrf_token()

    def _login(self):
        csrf_token = self._bootstrap_csrf()

        response = self.client.post(
            LOGIN_URL,
            {
                "username": self.username,
                "password": self.password,
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        return response

    def test_csrf_endpoint_bootstraps_csrf_cookie(self) -> None:
        self._bootstrap_csrf()

    def test_login_without_csrf_is_rejected(self) -> None:
        response = self.client.post(
            LOGIN_URL,
            {
                "username": self.username,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            response["Content-Type"].split(";")[0],
            "application/json",
        )

        # CSRF failure must not accidentally authenticate the user.
        self.assertNotIn(
            settings.SESSION_COOKIE_NAME,
            self.client.cookies,
        )

    def test_login_creates_authenticated_session_and_rotates_csrf_token(
        self,
    ) -> None:
        csrf_token_before_login = self._bootstrap_csrf()

        response = self.client.post(
            LOGIN_URL,
            {
                "username": self.username,
                "password": self.password,
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token_before_login,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn(
            settings.SESSION_COOKIE_NAME,
            self.client.cookies,
        )
        self.assertEqual(
            self.client.session[SESSION_KEY],
            str(self.user.pk),
        )

        csrf_token_after_login = self._csrf_token()

        self.assertNotEqual(
            csrf_token_before_login,
            csrf_token_after_login,
        )

    def test_invalid_credentials_do_not_create_session_or_disclose_username(
        self,
    ) -> None:
        csrf_token = self._bootstrap_csrf()

        existing_user_response = self.client.post(
            LOGIN_URL,
            {
                "username": self.username,
                "password": "wrong-password",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        missing_user_response = self.client.post(
            LOGIN_URL,
            {
                "username": "missing-user",
                "password": "wrong-password",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(
            existing_user_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            missing_user_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        # Existing and nonexistent usernames must produce the same API result.
        self.assertEqual(
            existing_user_response.json(),
            missing_user_response.json(),
        )

        self.assertNotIn(
            self.username,
            str(existing_user_response.json()),
        )

        self.assertNotIn(
            settings.SESSION_COOKIE_NAME,
            self.client.cookies,
        )

    def test_authenticated_user_can_access_me(self) -> None:
        self._login()

        response = self.client.get(ME_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "id": str(self.user.pk),
            },
        )

    def test_unauthenticated_user_cannot_access_me(self) -> None:
        response = self.client.get(ME_URL)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_logout_terminates_authenticated_session(self) -> None:
        self._login()

        # login() rotates the CSRF token, so obtain the current value.
        csrf_token = self._csrf_token()

        response = self.client.post(
            LOGOUT_URL,
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            SESSION_KEY,
            self.client.session,
        )

        me_response = self.client.get(ME_URL)

        self.assertEqual(
            me_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_authenticated_unsafe_request_without_csrf_is_rejected(
        self,
    ) -> None:
        self._login()

        response = self.client.post(LOGOUT_URL)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            response["Content-Type"].split(";")[0],
            "application/json",
        )

        # Failed CSRF validation must not log the user out.
        self.assertIn(
            SESSION_KEY,
            self.client.session,
        )

        me_response = self.client.get(ME_URL)

        self.assertEqual(
            me_response.status_code,
            status.HTTP_200_OK,
        )
