from django.db import models
from django.utils import timezone

from common.uuid7 import uuid7


class ActiveManager(models.Manager):
    """Default manager that excludes soft-deleted records."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class AllObjectsManager(models.Manager):
    """Manager that includes all records, including soft-deleted ones."""

    pass


class BaseModel(models.Model):
    """Abstract base model providing UUIDv7 primary keys and timestamps."""

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeletableModel(models.Model):
    """Abstract model providing soft-delete functionality with custom managers."""

    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def delete(self, using=None, keep_parents=False):
        """Perform a soft delete by setting deleted_at timestamp."""
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def hard_delete(self, using=None, keep_parents=False):
        """Perform a physical delete from the database."""
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])


class SyncableModel(BaseModel, SoftDeletableModel):
    """Abstract model for entities synchronized with mobile edge databases."""

    version = models.PositiveIntegerField(default=1)
    server_sequence = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        abstract = True
