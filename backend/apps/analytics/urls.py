from django.urls import path

from apps.analytics.api.views import DashboardAnalyticsView

app_name = "analytics"

urlpatterns = [
    path("dashboard/", DashboardAnalyticsView.as_view(), name="dashboard-metrics"),
]
