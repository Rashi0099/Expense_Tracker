from django.urls import path

from apps.income.api.views import IncomeDetailView, IncomeListCreateView

app_name = "income"

urlpatterns = [
    path("", IncomeListCreateView.as_view(), name="income-list-create"),
    path("<uuid:pk>/", IncomeDetailView.as_view(), name="income-detail"),
]
