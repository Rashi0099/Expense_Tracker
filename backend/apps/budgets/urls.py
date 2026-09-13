from django.urls import path

from apps.budgets.api.views import BudgetDetailView, BudgetListCreateView

app_name = "budgets"

urlpatterns = [
    path("", BudgetListCreateView.as_view(), name="budget-list-create"),
    path("<uuid:pk>/", BudgetDetailView.as_view(), name="budget-detail"),
]
