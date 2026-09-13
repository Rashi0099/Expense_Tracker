from datetime import date
from decimal import Decimal

from django.db.models import Sum

from apps.budgets.models import Budget
from apps.expenses.models import Expense


def get_first_and_last_day_of_month(target_date: date) -> tuple[date, date]:
    """Given a date, returns the (first_day, last_day) of that calendar month."""
    first_day = target_date.replace(day=1)
    if first_day.month == 12:
        next_month_first = first_day.replace(year=first_day.year + 1, month=1)
    else:
        next_month_first = first_day.replace(month=first_day.month + 1)
    from datetime import timedelta

    last_day = next_month_first - timedelta(days=1)
    return first_day, last_day


def get_monthly_budgets_with_consumption(user, period_start: date) -> dict:
    """
    Computes real-time dynamic consumption metrics (spent, remaining, percentage_used)
    for both overall and category-specific budgets in the specified month.
    """
    first_day, last_day = get_first_and_last_day_of_month(period_start)

    # Fetch active budgets for this user and period
    budgets = Budget.objects.filter(
        user=user,
        period_start=first_day,
    ).select_related("category")

    # Fetch active expenses aggregated by category for this month
    expense_aggregates = (
        Expense.objects.filter(
            user=user,
            transaction_date__gte=first_day,
            transaction_date__lte=last_day,
        )
        .values("category_id")
        .annotate(total_spent=Sum("amount"))
    )
    spend_by_cat = {item["category_id"]: item["total_spent"] for item in expense_aggregates}

    # Total month spending
    total_month_spent = Expense.objects.filter(
        user=user,
        transaction_date__gte=first_day,
        transaction_date__lte=last_day,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    overall_budget_obj = None
    category_budgets = []

    for b in budgets:
        if b.category_id is None:
            spent = total_month_spent
            remaining = b.limit_amount - spent
            pct = (
                round((spent / b.limit_amount * 100), 2) if b.limit_amount > 0 else Decimal("0.00")
            )
            overall_budget_obj = {
                "id": b.id,
                "limitAmount": str(b.limit_amount),
                "currency": b.currency,
                "spent": str(spent),
                "remaining": str(remaining),
                "percentageUsed": float(pct),
            }
        else:
            cat_spent = spend_by_cat.get(b.category_id, Decimal("0.00"))
            remaining = b.limit_amount - cat_spent
            pct = (
                round((cat_spent / b.limit_amount * 100), 2)
                if b.limit_amount > 0
                else Decimal("0.00")
            )
            category_budgets.append(
                {
                    "id": b.id,
                    "categoryId": b.category_id,
                    "categoryName": b.category.name,
                    "limitAmount": str(b.limit_amount),
                    "currency": b.currency,
                    "spent": str(cat_spent),
                    "remaining": str(remaining),
                    "percentageUsed": float(pct),
                    "version": b.version,
                }
            )

    return {
        "period": first_day.strftime("%Y-%m"),
        "overallBudget": overall_budget_obj,
        "categoryBudgets": category_budgets,
    }
