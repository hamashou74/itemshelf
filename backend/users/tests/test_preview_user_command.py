from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from ..models import User


class ProvisionPreviewUserCommandTests(TestCase):
    def test_requires_username(self) -> None:
        with (
            patch.dict(
                "os.environ",
                {"PREVIEW_PASSWORD": "preview-password"},
                clear=True,
            ),
            self.assertRaisesMessage(
                CommandError,
                "PREVIEW_USERNAME must be set.",
            ),
        ):
            call_command("provision_preview_user")

    def test_requires_password(self) -> None:
        with (
            patch.dict(
                "os.environ",
                {"PREVIEW_USERNAME": "preview"},
                clear=True,
            ),
            self.assertRaisesMessage(
                CommandError,
                "PREVIEW_PASSWORD must be set.",
            ),
        ):
            call_command("provision_preview_user")

    def test_creates_non_privileged_user(self) -> None:
        output = StringIO()

        with patch.dict(
            "os.environ",
            {
                "PREVIEW_USERNAME": "preview",
                "PREVIEW_PASSWORD": "initial-password",
            },
            clear=True,
        ):
            call_command("provision_preview_user", stdout=output)

        user = User.objects.get(username="preview")
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("initial-password"))
        self.assertIn("Created preview user preview.", output.getvalue())

    def test_updates_existing_user_idempotently(self) -> None:
        user = User.objects.create_superuser(
            username="preview",
            password="old-password",
        )
        output = StringIO()

        with patch.dict(
            "os.environ",
            {
                "PREVIEW_USERNAME": "preview",
                "PREVIEW_PASSWORD": "new-password",
            },
            clear=True,
        ):
            call_command("provision_preview_user", stdout=output)

        user.refresh_from_db()
        self.assertEqual(User.objects.filter(username="preview").count(), 1)
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("new-password"))
        self.assertIn("Updated preview user preview.", output.getvalue())
