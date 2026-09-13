from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import Device
from apps.notifications.api.serializers import (
    NotificationLogSerializer,
    RegisterPushTokenSerializer,
)
from apps.notifications.models import NotificationLog


class RegisterPushTokenView(APIView):
    """Registers or refreshes the FCM push notification token for a user's device."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=RegisterPushTokenSerializer, responses={200: dict})
    def post(self, request):
        serializer = RegisterPushTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        device_id = serializer.validated_data["deviceId"]
        push_token = serializer.validated_data["pushToken"]

        device = Device.objects.filter(id=device_id, user=request.user).first()
        if not device:
            # If device doesn't exist yet, provision it for the authenticated user
            device = Device.objects.create(
                id=device_id,
                user=request.user,
                platform="ANDROID",
                device_name="Mobile Device",
                client_version="1.0.0",
            )

        device.push_token = push_token
        device.push_token_updated_at = timezone.now()
        device.save(update_fields=["push_token", "push_token_updated_at"])

        return Response(
            {
                "status": "SUCCESS",
                "deviceId": str(device.id),
                "message": "FCM push token registered successfully.",
            },
            status=status.HTTP_200_OK,
        )


class NotificationHistoryView(APIView):
    """Retrieves recent push notification history for the authenticated user."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: NotificationLogSerializer(many=True)})
    def get(self, request):
        logs = NotificationLog.objects.filter(user=request.user).order_by("-created_at")[:50]
        serializer = NotificationLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
