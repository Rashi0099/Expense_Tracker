from datetime import datetime

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.selectors.dashboard_selectors import get_dashboard_metrics


class DashboardAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Retrieve aggregated financial dashboard metrics",
        parameters=[
            OpenApiParameter(
                name="startDate",
                description="Filter start date (YYYY-MM-DD)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="endDate", description="Filter end date (YYYY-MM-DD)", required=False, type=str
            ),
        ],
    )
    def get(self, request):
        start_str = request.query_params.get("startDate")
        end_str = request.query_params.get("endDate")

        start_date = None
        end_date = None

        if start_str:
            try:
                start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError({"startDate": ["Invalid format. Expected YYYY-MM-DD."]})

        if end_str:
            try:
                end_date = datetime.strptime(end_str, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError({"endDate": ["Invalid format. Expected YYYY-MM-DD."]})

        data = get_dashboard_metrics(request.user, start_date, end_date)
        return Response(data, status=status.HTTP_200_OK)
