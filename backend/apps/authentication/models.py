from django.conf import settings
from django.db import models

from common.uuid7 import uuid7


class Device(models.Model):
    """Represents a registered physical client or web instance."""

    PLATFORM_CHOICES = (
        ("IOS", "iOS"),
        ("ANDROID", "Android"),
        ("WEB", "Web"),
    )

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="devices",
        db_index=True,
    )
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    device_name = models.CharField(max_length=100)
    client_version = models.CharField(max_length=20)
    last_sync_sequence = models.BigIntegerField(default=0)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    push_token = models.CharField(max_length=512, null=True, blank=True, db_index=True)
    push_token_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "devices"
        verbose_name = "Device"
        verbose_name_plural = "Devices"

    def __str__(self):
        return f"{self.device_name} ({self.platform}) - {self.user.email}"


class RefreshSession(models.Model):
    """Tracks stateful refresh tokens with single-use rotation and reuse detection."""

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        related_name="refresh_sessions",
        db_index=True,
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    family_id = models.UUIDField(db_index=True)
    is_revoked = models.BooleanField(default=False)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "refresh_sessions"
        verbose_name = "Refresh Session"
        verbose_name_plural = "Refresh Sessions"

    def __str__(self):
        return f"Session {self.id} (Device {self.device_id}) - Revoked: {self.is_revoked}"
