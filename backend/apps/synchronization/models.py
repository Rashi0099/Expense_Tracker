from django.conf import settings
from django.db import models

from common.uuid7 import uuid7


class SyncOperationLog(models.Model):
    """Idempotency log tracking processed mutation IDs from client devices."""

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sync_operation_logs",
        db_index=True,
    )
    device = models.ForeignKey(
        "authentication.Device",
        on_delete=models.CASCADE,
        related_name="sync_operation_logs",
        db_index=True,
    )
    operation_id = models.UUIDField(unique=True, db_index=True)
    entity_type = models.CharField(max_length=32)
    entity_id = models.UUIDField(db_index=True)
    operation = models.CharField(max_length=10)
    server_version = models.PositiveIntegerField(default=1)
    server_sequence = models.BigIntegerField(default=0, db_index=True)
    status = models.CharField(max_length=20, default="ACCEPTED")
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sync_operation_logs"
        verbose_name = "Sync Operation Log"
        verbose_name_plural = "Sync Operation Logs"

    def __str__(self):
        return f"Op {self.operation_id} [{self.operation} {self.entity_type}] by Device {self.device_id}"


class UserSyncSequence(models.Model):
    """Monotonic sequence revision counter scoped per user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="sync_sequence",
    )
    current_sequence = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_sync_sequences"
        verbose_name = "User Sync Sequence"
        verbose_name_plural = "User Sync Sequences"

    def __str__(self):
        return f"User {self.user_id} Sequence: {self.current_sequence}"


class Tombstone(models.Model):
    """Permanent deletion marker propagating deletions to offline clients."""

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tombstones",
        db_index=True,
    )
    entity_type = models.CharField(max_length=32)
    entity_id = models.UUIDField(unique=True, db_index=True)
    server_sequence = models.BigIntegerField(db_index=True)
    deleted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tombstones"
        verbose_name = "Tombstone"
        verbose_name_plural = "Tombstones"

    def __str__(self):
        return f"Tombstone {self.entity_type} {self.entity_id} (seq: {self.server_sequence})"
