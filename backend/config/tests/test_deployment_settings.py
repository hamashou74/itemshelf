from django.test import SimpleTestCase

from config.settings import deployment


class DeploymentSecuritySettingsTests(SimpleTestCase):
    def test_trusted_proxy_scheme_header_is_configured(self) -> None:
        self.assertEqual(
            deployment.SECURE_PROXY_SSL_HEADER,
            ("HTTP_X_FORWARDED_PROTO", "https"),
        )

    def test_session_and_csrf_cookies_are_secure(self) -> None:
        self.assertTrue(deployment.SESSION_COOKIE_SECURE)
        self.assertTrue(deployment.CSRF_COOKIE_SECURE)

    def test_ingress_owns_https_redirect_and_hsts(self) -> None:
        self.assertFalse(deployment.SECURE_SSL_REDIRECT)
        self.assertEqual(deployment.SECURE_HSTS_SECONDS, 0)
        self.assertEqual(
            deployment.SILENCED_SYSTEM_CHECKS,
            [
                "security.W004",
                "security.W008",
            ],
        )
