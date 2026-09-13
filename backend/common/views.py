import logging

from django.db import connection
from django.http import JsonResponse
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    """
    Health check endpoint reporting overall system health (liveness and DB readiness).
    Never exposes credentials, secrets, or internal stack traces.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        summary="System readiness and database health probe",
        responses={
            200: inline_serializer(
                name="HealthCheckSuccess",
                fields={
                    "status": serializers.CharField(),
                    "components": serializers.DictField(),
                },
            ),
            503: inline_serializer(
                name="HealthCheckFailure",
                fields={
                    "status": serializers.CharField(),
                    "components": serializers.DictField(),
                },
            ),
        },
    )
    def get(self, request):
        db_healthy = False
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
                if row and row[0] == 1:
                    db_healthy = True
        except Exception as exc:
            logger.error("Health check database probe failed: %s", exc)
            db_healthy = False

        if db_healthy:
            return JsonResponse(
                {
                    "status": "healthy",
                    "components": {
                        "application": "ok",
                        "database": "connected",
                    },
                },
                status=status.HTTP_200_OK,
            )

        return JsonResponse(
            {
                "status": "unhealthy",
                "components": {
                    "application": "ok",
                    "database": "disconnected",
                },
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class LivenessCheckView(APIView):
    """
    Kubernetes / process liveness probe. Checks that the web process responds to HTTP.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        summary="Process liveness probe",
        responses={
            200: inline_serializer(
                name="LivenessSuccess",
                fields={"status": serializers.CharField()},
            )
        },
    )
    def get(self, request):
        return JsonResponse({"status": "live"}, status=status.HTTP_200_OK)
