from django.conf import settings
from django.test import SimpleTestCase
from django.urls import reverse
from drf_spectacular.generators import SchemaGenerator

from ..api.openapi import CSRF_HEADER_PARAMETER


class AuthenticationOpenApiTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()

        schema = SchemaGenerator().get_schema(
            request=None,
            public=True,
        )

        if schema is None:
            raise AssertionError("OpenAPI schema generation returned None.")

        cls.schema = schema

    def _operation(
        self,
        route_name: str,
        method: str,
    ) -> dict:
        path = reverse(f"users_api:{route_name}")
        return self.schema["paths"][path][method]

    def test_auth_operations_have_stable_operation_ids(self) -> None:
        expected = {
            ("csrf", "get"): "auth_csrf",
            ("login", "post"): "auth_login",
            ("logout", "post"): "auth_logout",
            ("me", "get"): "auth_me",
        }

        for (route_name, method), operation_id in expected.items():
            with self.subTest(
                route_name=route_name,
                method=method,
            ):
                operation = self._operation(route_name, method)

                self.assertEqual(
                    operation["operationId"],
                    operation_id,
                )
                self.assertEqual(
                    operation["tags"],
                    ["auth"],
                )

    def test_login_is_anonymous_but_requires_csrf_header(self) -> None:
        operation = self._operation("login", "post")

        self.assertNotIn("security", operation)

        parameters = {
            parameter["name"]: parameter for parameter in operation["parameters"]
        }

        csrf_parameter = parameters[CSRF_HEADER_PARAMETER.name]

        self.assertEqual(
            csrf_parameter["in"],
            "header",
        )
        self.assertTrue(csrf_parameter["required"])

    def test_login_accepts_only_json_request_body(self) -> None:
        operation = self._operation("login", "post")

        content = operation["requestBody"]["content"]

        self.assertEqual(
            set(content),
            {"application/json"},
        )

    def test_login_uses_separate_request_component(self) -> None:
        operation = self._operation("login", "post")

        schema = operation["requestBody"]["content"]["application/json"]["schema"]

        self.assertEqual(
            schema["$ref"],
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
        for route_name, method in (
            ("logout", "post"),
            ("me", "get"),
        ):
            with self.subTest(
                route_name=route_name,
                method=method,
            ):
                operation = self._operation(
                    route_name,
                    method,
                )

                self.assertEqual(
                    operation["security"],
                    [{"cookieAuth": []}],
                )

    def test_successful_empty_responses_have_no_body(self) -> None:
        for route_name, method in (
            ("csrf", "get"),
            ("login", "post"),
            ("logout", "post"),
        ):
            with self.subTest(
                route_name=route_name,
                method=method,
            ):
                operation = self._operation(
                    route_name,
                    method,
                )

                response = operation["responses"]["200"]

                self.assertNotIn("content", response)

    def test_current_user_response_uses_current_user_schema(
        self,
    ) -> None:
        operation = self._operation("me", "get")

        response_schema = operation["responses"]["200"]["content"]["application/json"][
            "schema"
        ]

        self.assertEqual(
            response_schema["$ref"],
            "#/components/schemas/CurrentUser",
        )
