from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

from common.models import SyncableModel


class Category(SyncableModel):
    """Hierarchical category taxonomy supporting system defaults and user-defined custom categories."""

    TYPE_CHOICES = (
        ("EXPENSE", "Expense"),
        ("INCOME", "Income"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="categories",
        db_index=True,
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="subcategories",
    )
    name = models.CharField(max_length=64)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, db_index=True)
    icon = models.CharField(max_length=64, default="default")
    color = models.CharField(
        max_length=7,
        default="#808080",
        validators=[
            RegexValidator(
                regex=r"^#[0-9A-Fa-f]{6}$",
                message="Color must be a valid 6-digit hex code (e.g. #10B981).",
            )
        ],
    )
    is_system = models.BooleanField(default=False, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "categories"
        verbose_name = "Category"
        verbose_name_plural = "Categories"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(is_system=True, user__isnull=True)
                    | models.Q(is_system=False, user__isnull=False)
                ),
                name="chk_category_system_ownership",
            ),
            models.CheckConstraint(
                condition=models.Q(color__regex=r"^#[0-9A-Fa-f]{6}$"),
                name="chk_category_hex_color",
            ),
        ]

    def __str__(self):
        prefix = "[System] " if self.is_system else ""
        return f"{prefix}{self.name} ({self.type})"
