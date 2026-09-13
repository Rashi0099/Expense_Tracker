from django.urls import path

from apps.synchronization.api.views import SyncView

app_name = "synchronization"

urlpatterns = [
    path("", SyncView.as_view(), name="sync"),
]
