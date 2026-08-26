from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from django.views.decorators.debug import sensitive_variables
from rest_framework import serializers

from .models import User


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(
        label=_("Username"),
        write_only=True,
    )
    password = serializers.CharField(
        label=_("Password"),
        style={"input_type": "password"},
        trim_whitespace=False,
        write_only=True,
    )

    @sensitive_variables()
    def validate(self, attrs: dict):
        username = attrs.get("username")
        password = attrs.get("password")

        if username and password:
            user = authenticate(
                request=self.context.get("request"),
                username=username,
                password=password,
            )

            if not user:
                msg = _("Unable to log in with provided credentials.")
                raise serializers.ValidationError(msg, code="authorization")
        else:
            msg = _('Must include "username" and "password".')
            raise serializers.ValidationError(msg, code="authorization")

        attrs["user"] = user
        return attrs


class CurrentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id",)
        read_only_fields = ("id",)
