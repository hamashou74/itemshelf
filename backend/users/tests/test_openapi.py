from django.conf import settings
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from drf_spectacular.generators import SchemaGenerator
from rest_framework import status

from ..api.openapi import AUTH_TAG, CSRF_HEADER_PARAMETER
from ..models import User

SCHEMA_PATH = reverse("schema")
CSRF_PATH = reverse("auth:csrf")
LOGIN_PATH = reverse("auth:login")
LOGOUT_PATH = reverse("auth:logout")
CURRENT_USER_PATH = reverse("auth:me")

AUTH_OPERATIONS = {
    CSRF_PATH: "get",
    LOGIN_PATH: "post",
    LOGOUT_PATH: "post",
    CURRENT_USER_PATH: "get",
}


class AuthenticationOpenApiTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()

        schema = SchemaGenerator().get_schema(
            request=None,
            public=True,
        )

        if schema is None:
            raise AssertionError(
                "OpenAPI schema generation returned None.",
            )

        cls.schema = schema

    def _operation(
        self,
        path: str,
        method: str,
    ) -> dict:
        return self.schema["paths"][path][method]

    def test_authentication_operations_are_exposed(self) -> None:
        for path, method in AUTH_OPERATIONS.items():
            with self.subTest(
                path=path,
                method=method,
            ):
                self.assertIn(
                    path,
                    self.schema["paths"],
                )
                self.assertIn(
                    method,
                    self.schema["paths"][path],
                )

    def test_authentication_operations_use_auth_tag(self) -> None:
        for path, method in AUTH_OPERATIONS.items():
            with self.subTest(
                path=path,
                method=method,
            ):
                operation = self._operation(
                    path,
                    method,
                )

                self.assertEqual(
                    operation["tags"],
                    [AUTH_TAG],
                )

    def test_schema_endpoint_is_not_included_in_schema(self) -> None:
        self.assertNotIn(
            SCHEMA_PATH,
            self.schema["paths"],
        )

    def test_login_is_anonymous_but_requires_csrf_header(self) -> None:
        operation = self._operation(
            LOGIN_PATH,
            "post",
        )

        self.assertNotIn(
            "security",
            operation,
        )

        parameters = {
            parameter["name"]: parameter for parameter in operation["parameters"]
        }

        csrf_parameter = parameters[CSRF_HEADER_PARAMETER.name]

        self.assertEqual(
            csrf_parameter["in"],
            "header",
        )
        self.assertTrue(
            csrf_parameter["required"],
        )

    def test_login_accepts_only_json_request_body(self) -> None:
        operation = self._operation(
            LOGIN_PATH,
            "post",
        )

        content = operation["requestBody"]["content"]

        self.assertEqual(
            set(content),
            {"application/json"},
        )

    def test_login_uses_separate_request_component(self) -> None:
        operation = self._operation(
            LOGIN_PATH,
            "post",
        )

        request_schema = operation["requestBody"]["content"]["application/json"][
            "schema"
        ]

        self.assertEqual(
            request_schema["$ref"],
            "#/components/schemas/LoginRequest",
        )

        login_request = self.schema["components"]["schemas"]["LoginRequest"]

        self.assertEqual(
            set(login_request["properties"]),
            {"username", "password"},
        )

    def test_session_authentication_uses_configured_cookie_name(
        self,
    ) -> None:
        cookie_auth = self.schema["components"]["securitySchemes"]["cookieAuth"]

        self.assertEqual(
            cookie_auth,
            {
                "type": "apiKey",
                "in": "cookie",
                "name": settings.SESSION_COOKIE_NAME,
            },
        )

    def test_protected_operations_require_session_cookie(
        self,
    ) -> None:
        protected_operations = {
            LOGOUT_PATH: "post",
            CURRENT_USER_PATH: "get",
        }

        for path, method in protected_operations.items():
            with self.subTest(
                path=path,
                method=method,
            ):
                operation = self._operation(
                    path,
                    method,
                )

                self.assertEqual(
                    operation["security"],
                    [{"cookieAuth": []}],
                )

    def test_successful_empty_responses_have_no_body(self) -> None:
        empty_response_operations = {
            CSRF_PATH: "get",
            LOGIN_PATH: "post",
            LOGOUT_PATH: "post",
        }

        for path, method in empty_response_operations.items():
            with self.subTest(
                path=path,
                method=method,
            ):
                operation = self._operation(
                    path,
                    method,
                )

                response = operation["responses"]["200"]

                self.assertNotIn(
                    "content",
                    response,
                )

    def test_current_user_response_uses_current_user_schema(
        self,
    ) -> None:
        operation = self._operation(
            CURRENT_USER_PATH,
            "get",
        )

        response_schema = operation["responses"]["200"]["content"]["application/json"][
            "schema"
        ]

        self.assertEqual(
            response_schema["$ref"],
            "#/components/schemas/CurrentUser",
        )


class SchemaEndpointTests(TestCase):
    def test_anonymous_user_cannot_access_schema(self) -> None:
        response = self.client.get(SCHEMA_PATH)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_user_can_access_schema(self) -> None:
        user = User.objects.create_user(
            username="schema-admin",
            password="test-password",
            is_staff=True,
        )
        self.client.force_login(user)

        response = self.client.get(SCHEMA_PATH)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
