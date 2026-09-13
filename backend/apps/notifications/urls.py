from django.urls import path

from apps.notifications.api.views import (
    NotificationHistoryView,
    RegisterPushTokenView,
)

app_name = "notifications"

urlpatterns = [
    path("push-token/", RegisterPushTokenView.as_view(), name="register-push-token"),
    path("", NotificationHistoryView.as_view(), name="notification-history"),
]
