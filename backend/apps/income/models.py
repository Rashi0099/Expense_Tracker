from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from common.models import SyncableModel


class Income(SyncableModel):
    """Transactional financial record for monetary inflow."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="incomes",
        db_index=True,
    )
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.RESTRICT,
        related_name="incomes",
        db_index=True,
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
    )
    currency = models.CharField(
        max_length=3,
        default="USD",
        validators=[RegexValidator(regex=r"^[A-Z]{3}$")],
    )
    transaction_date = models.DateField(db_index=True)
    source = models.CharField(max_length=100, null=True, blank=True)
    payment_method = models.CharField(max_length=32, default="BANK_TRANSFER")
    note = models.TextField(null=True, blank=True)
    client_created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "income"
        verbose_name = "Income"
        verbose_name_plural = "Incomes"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="chk_income_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(currency__regex=r"^[A-Z]{3}$"),
                name="chk_income_currency_iso",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "-transaction_date"], name="idx_income_user_date"),
            models.Index(fields=["user", "server_sequence"], name="idx_income_sync_seq"),
        ]

    def __str__(self):
        return (
            f"+{self.amount} {self.currency} - {self.source or 'Income'} ({self.transaction_date})"
        )
