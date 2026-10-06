import importlib
import os
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

from django.test import SimpleTestCase


class DevelopmentSettingsTests(SimpleTestCase):
    def reload_development_settings(
        self,
        environment: dict[str, str],
    ) -> ModuleType:
        with (
            patch.dict(os.environ, environment, clear=True),
            patch("environ.Env.read_env"),
        ):
            module = importlib.import_module("config.settings.development")
            return importlib.reload(module)

    def test_uses_local_defaults_without_optional_overrides(self) -> None:
        development = self.reload_development_settings(
            {
                "DJANGO_SECRET_KEY": "development-test-secret",
            },
        )

        self.assertEqual(
            development.ALLOWED_HOSTS,
            ["localhost", "127.0.0.1", "[::1]"],
        )
        self.assertEqual(
            development.DATABASES["default"]["ENGINE"],
            "django.db.backends.sqlite3",
        )
        self.assertEqual(
            Path(str(development.DATABASES["default"]["NAME"])),
            development.BASE_DIR / "db.sqlite3",
        )

    def test_environment_can_override_local_defaults(self) -> None:
        development = self.reload_development_settings(
            {
                "DJANGO_SECRET_KEY": "development-test-secret",
                "DJANGO_ALLOWED_HOSTS": "dev.example.test",
                "DATABASE_URL": "sqlite://:memory:",
            },
        )

        self.assertEqual(development.ALLOWED_HOSTS, ["dev.example.test"])
        self.assertEqual(
            development.DATABASES["default"]["NAME"],
            ":memory:",
        )
