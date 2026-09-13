from django.urls import path

from apps.categories.api.views import CategoryDetailView, CategoryListCreateView

app_name = "categories"

urlpatterns = [
    path("", CategoryListCreateView.as_view(), name="category-list-create"),
    path("<uuid:pk>/", CategoryDetailView.as_view(), name="category-detail"),
]
