from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from common.models import SyncableModel


class Expense(SyncableModel):
    """Transactional financial record for monetary outflow."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses",
        db_index=True,
    )
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.RESTRICT,
        related_name="expenses",
        db_index=True,
    )
    recurring_expense = models.ForeignKey(
        "recurring.RecurringExpense",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_expenses",
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
    payment_method = models.CharField(max_length=32, default="CASH")
    payee = models.CharField(max_length=100, null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    client_created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "expenses"
        verbose_name = "Expense"
        verbose_name_plural = "Expenses"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="chk_expense_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(currency__regex=r"^[A-Z]{3}$"),
                name="chk_expense_currency_iso",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "-transaction_date"], name="idx_expenses_user_date"),
            models.Index(
                fields=["user", "category", "transaction_date"], name="idx_expenses_cat_spend"
            ),
            models.Index(fields=["user", "server_sequence"], name="idx_expenses_sync_seq"),
        ]

    def __str__(self):
        return (
            f"{self.amount} {self.currency} - {self.payee or 'Expense'} ({self.transaction_date})"
        )
