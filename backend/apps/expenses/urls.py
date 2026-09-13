from django.urls import path

from apps.expenses.api.views import ExpenseDetailView, ExpenseListCreateView

app_name = "expenses"

urlpatterns = [
    path("", ExpenseListCreateView.as_view(), name="expense-list-create"),
    path("<uuid:pk>/", ExpenseDetailView.as_view(), name="expense-detail"),
]
