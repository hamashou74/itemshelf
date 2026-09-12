from django.urls import reverse
from rest_framework import status
from rest_framework.test import APISimpleTestCase


class HealthViewTests(APISimpleTestCase):
    def test_health_returns_ok_without_authentication(self) -> None:
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"status": "ok"})
