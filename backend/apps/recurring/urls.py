from django.urls import path

from apps.recurring.api.views import (
    RecurringExpenseDetailView,
    RecurringExpenseListCreateView,
)

app_name = "recurring"

urlpatterns = [
    path("", RecurringExpenseListCreateView.as_view(), name="recurring-list-create"),
    path("<uuid:pk>/", RecurringExpenseDetailView.as_view(), name="recurring-detail"),
]
