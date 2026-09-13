from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from common.views import HealthCheckView, LivenessCheckView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("health/live/", LivenessCheckView.as_view(), name="health-live"),
    path("api/v1/health/", HealthCheckView.as_view(), name="api-v1-health-check"),
    # OpenAPI 3.1 Documentation (Swagger & ReDoc)
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Domain APIs (v1)
    path("api/v1/auth/", include("apps.authentication.urls", namespace="authentication")),
    path("api/v1/categories/", include("apps.categories.urls", namespace="categories")),
    path("api/v1/expenses/", include("apps.expenses.urls", namespace="expenses")),
    path("api/v1/income/", include("apps.income.urls", namespace="income")),
    path("api/v1/budgets/", include("apps.budgets.urls", namespace="budgets")),
    path("api/v1/recurring/", include("apps.recurring.urls", namespace="recurring")),
    path("api/v1/analytics/", include("apps.analytics.urls", namespace="analytics")),
    path("api/v1/sync/", include("apps.synchronization.urls", namespace="synchronization")),
    path("api/v1/notifications/", include("apps.notifications.urls", namespace="notifications")),
]
