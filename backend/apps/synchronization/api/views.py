from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import Device
from apps.synchronization.api.serializers import (
    SyncRequestSerializer,
    SyncResponseSerializer,
)
from apps.synchronization.services.sync_service import SyncService


class SyncView(APIView):
    """
    Offline Synchronization Endpoint (POST /api/v1/sync/)

    Atomically commits offline mutations from the client outbox and returns
    incremental server deltas based on the client's monotonic sequence cursor.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SyncRequestSerializer,
        responses={200: SyncResponseSerializer},
        summary="Bidirectional delta synchronization",
        description="Drain client outbox mutations and pull incremental deltas with monotonic sequence cursor.",
    )
    def post(self, request):
        serializer = SyncRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        device_id = serializer.validated_data["deviceId"]
        device, _ = Device.objects.get_or_create(
            id=device_id,
            user=request.user,
            defaults={
                "device_name": "Mobile Device",
                "platform": "IOS",
                "client_version": "0.1.0",
            },
        )

        result = SyncService.process_sync_batch(
            user=request.user,
            device=device,
            since_sequence=serializer.validated_data["sinceSequence"],
            operations=serializer.validated_data["operations"],
        )

        return Response(result, status=status.HTTP_200_OK)
