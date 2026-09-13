from django.conf import settings
from django.db import models

from apps.authentication.models import Device
from common.models import BaseModel


class NotificationLog(BaseModel):
    """Tracks every push notification dispatched to devices for deduplication and audit."""

    TYPE_CHOICES = (
        ("RECURRING_DUE", "Recurring Bill Due"),
        ("BUDGET_WARNING", "Budget 80% Warning"),
        ("BUDGET_EXCEEDED", "Budget 100% Exceeded"),
        ("REMOTE_SYNC_PING", "Remote Data Sync Ping"),
        ("GENERAL", "General Notification"),
    )

    STATUS_CHOICES = (
        ("SENT", "Delivered to FCM"),
        ("FAILED", "Delivery Failed"),
        ("SIMULATED", "Simulated in Dev/Test"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=32, choices=TYPE_CHOICES, db_index=True)
    stable_key = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Deterministic key used for deduplication (e.g. rec_UUID_DATE)",
    )
    title = models.CharField(max_length=255)
    body = models.TextField()
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="SENT")
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "notification_logs"
        verbose_name = "Notification Log"
        verbose_name_plural = "Notification Logs"
        indexes = [
            models.Index(fields=["user", "stable_key"], name="idx_notif_user_key"),
            models.Index(fields=["user", "created_at"], name="idx_notif_user_created"),
        ]

    def __str__(self):
        return f"{self.notification_type} ({self.status}) - {self.user.email} - {self.title}"
