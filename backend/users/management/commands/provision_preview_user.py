import os

from django.core.management.base import BaseCommand, CommandError

from users.models import User

USERNAME_ENV = "PREVIEW_USERNAME"
PASSWORD_ENV = "PREVIEW_PASSWORD"


class Command(BaseCommand):
    help = "Create or update the non-privileged user used by preview environments."

    def handle(self, *args: object, **options: object) -> None:
        username = os.environ.get(USERNAME_ENV, "").strip()
        password = os.environ.get(PASSWORD_ENV, "")

        if not username:
            raise CommandError(f"{USERNAME_ENV} must be set.")
        if not password:
            raise CommandError(f"{PASSWORD_ENV} must be set.")

        user, created = User.objects.get_or_create(username=username)
        user.is_active = True
        user.is_staff = False
        user.is_superuser = False
        user.set_password(password)
        user.save(
            update_fields=[
                "is_active",
                "is_staff",
                "is_superuser",
                "password",
            ]
        )

        action = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(f"{action} preview user {username}.")
        )
