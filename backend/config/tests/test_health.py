from django.test import SimpleTestCase
from django.urls import reverse


class HealthViewTests(SimpleTestCase):
    def test_health_returns_ok(self) -> None:
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"ok")
        self.assertEqual(response["Content-Type"], "text/plain")
