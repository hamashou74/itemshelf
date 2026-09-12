from unittest.mock import patch

from django.db import DatabaseError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthViewTests(APITestCase):
    def test_health_returns_ok_without_authentication(self) -> None:
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"status": "ok"})

    @patch("config.views.connection.cursor", side_effect=DatabaseError)
    def test_health_returns_unavailable_when_database_is_unreachable(
        self,
        _cursor,
    ) -> None:
        response = self.client.get(reverse("health"))

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
        self.assertEqual(response.data, {"status": "unavailable"})
