from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from common.models import SyncableModel


class RecurringExpense(SyncableModel):
    """Scheduling template for recurring bills and subscriptions (not a ledger entry)."""

    FREQUENCY_CHOICES = (
        ("DAILY", "Daily"),
        ("WEEKLY", "Weekly"),
        ("MONTHLY", "Monthly"),
        ("YEARLY", "Yearly"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recurring_expenses",
        db_index=True,
    )
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.RESTRICT,
        related_name="recurring_expenses",
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
    title = models.CharField(max_length=100)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    start_date = models.DateField()
    next_due_date = models.DateField(db_index=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "recurring_expenses"
        verbose_name = "Recurring Expense"
        verbose_name_plural = "Recurring Expenses"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="chk_recurring_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(currency__regex=r"^[A-Z]{3}$"),
                name="chk_recurring_currency_iso",
            ),
            models.CheckConstraint(
                condition=models.Q(end_date__isnull=True)
                | models.Q(end_date__gte=models.F("start_date")),
                name="chk_recurring_date_range",
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.amount} {self.currency} - {self.frequency})"
