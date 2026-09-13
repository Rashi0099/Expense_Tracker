from rest_framework import serializers

from apps.notifications.models import NotificationLog


class RegisterPushTokenSerializer(serializers.Serializer):
    deviceId = serializers.UUIDField(required=True)
    pushToken = serializers.CharField(max_length=512, required=True, allow_blank=False)


class NotificationLogSerializer(serializers.ModelSerializer):
    notificationType = serializers.CharField(source="notification_type")
    stableKey = serializers.CharField(source="stable_key")
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = NotificationLog
        fields = [
            "id",
            "notificationType",
            "stableKey",
            "title",
            "body",
            "payload",
            "status",
            "createdAt",
        ]
        read_only_fields = fields
