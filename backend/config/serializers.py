from rest_framework import serializers


class HealthSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=("ok", "unavailable"),
        read_only=True,
    )
