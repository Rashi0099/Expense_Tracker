from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from common.models import SyncableModel


class Budget(SyncableModel):
    """Spending limit defined per category or overall per calendar month."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="budgets",
        db_index=True,
    )
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="budgets",
        db_index=True,
    )
    period_start = models.DateField(db_index=True)
    limit_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
    )
    currency = models.CharField(
        max_length=3,
        default="USD",
        validators=[RegexValidator(regex=r"^[A-Z]{3}$")],
    )

    class Meta:
        db_table = "budgets"
        verbose_name = "Budget"
        verbose_name_plural = "Budgets"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(limit_amount__gt=0),
                name="chk_budget_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(currency__regex=r"^[A-Z]{3}$"),
                name="chk_budget_currency_iso",
            ),
            models.UniqueConstraint(
                fields=["user", "category", "period_start"],
                condition=models.Q(deleted_at__isnull=True, category__isnull=False),
                name="uq_user_category_month_budget",
            ),
            models.UniqueConstraint(
                fields=["user", "period_start"],
                condition=models.Q(deleted_at__isnull=True, category__isnull=True),
                name="uq_user_overall_month_budget",
            ),
        ]

    def __str__(self):
        cat_name = self.category.name if self.category else "Overall Monthly"
        return f"{cat_name} Budget ({self.period_start}): {self.limit_amount} {self.currency}"
