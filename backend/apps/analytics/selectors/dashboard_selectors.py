from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum

from apps.budgets.models import Budget
from apps.expenses.models import Expense
from apps.income.models import Income


def get_dashboard_metrics(
    user, start_date: date | None = None, end_date: date | None = None
) -> dict:
    today = date.today()
    if not start_date or not end_date:
        # Default to current month
        start_date = today.replace(day=1)
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1)
        else:
            next_month = today.replace(month=today.month + 1)
        end_date = next_month - timedelta(days=1)

    # Calculate Total Expenses in Period
    expense_agg = Expense.objects.filter(
        user=user,
        transaction_date__gte=start_date,
        transaction_date__lte=end_date,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    # Calculate Total Income in Period
    income_agg = Income.objects.filter(
        user=user,
        transaction_date__gte=start_date,
        transaction_date__lte=end_date,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    net_balance = income_agg - expense_agg

    # Current Calendar Month Expenses (for specific KPI)
    curr_month_start = today.replace(day=1)
    if today.month == 12:
        curr_next_month = today.replace(year=today.year + 1, month=1)
    else:
        curr_next_month = today.replace(month=today.month + 1)
    curr_month_end = curr_next_month - timedelta(days=1)

    this_month_spending = Expense.objects.filter(
        user=user,
        transaction_date__gte=curr_month_start,
        transaction_date__lte=curr_month_end,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    # Budget status for current month
    overall_budget = Budget.objects.filter(
        user=user,
        category__isnull=True,
        period_start=curr_month_start,
    ).first()

    remaining_budget = None
    budget_limit = None
    if overall_budget:
        budget_limit = str(overall_budget.limit_amount)
        rem = overall_budget.limit_amount - this_month_spending
        remaining_budget = str(rem)

    # Category Breakdown
    cat_expenses = (
        Expense.objects.filter(
            user=user,
            transaction_date__gte=start_date,
            transaction_date__lte=end_date,
        )
        .values(
            "category_id",
            "category__name",
            "category__color",
            "category__icon",
        )
        .annotate(total_spent=Sum("amount"))
        .order_by("-total_spent")
    )

    category_breakdown = []
    total_spent_val = float(expense_agg) if expense_agg > 0 else 1.0

    for item in cat_expenses:
        spent = float(item["total_spent"])
        pct = round((spent / total_spent_val) * 100, 1) if expense_agg > 0 else 0
        category_breakdown.append(
            {
                "categoryId": str(item["category_id"]),
                "categoryName": item["category__name"] or "Uncategorized",
                "categoryColor": item["category__color"] or "#64748B",
                "categoryIcon": item["category__icon"] or "📦",
                "totalSpent": str(item["total_spent"]),
                "percentage": pct,
            }
        )

    # Monthly Trend (Past 6 months)
    monthly_trends = []
    for i in range(5, -1, -1):
        m_year = today.year
        m_month = today.month - i
        while m_month <= 0:
            m_month += 12
            m_year -= 1
        m_start = date(m_year, m_month, 1)
        if m_month == 12:
            m_end = date(m_year + 1, 1, 1) - timedelta(days=1)
        else:
            m_end = date(m_year, m_month + 1, 1) - timedelta(days=1)

        m_exp = Expense.objects.filter(
            user=user,
            transaction_date__gte=m_start,
            transaction_date__lte=m_end,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        m_inc = Income.objects.filter(
            user=user,
            transaction_date__gte=m_start,
            transaction_date__lte=m_end,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        monthly_trends.append(
            {
                "month": m_start.strftime("%b %Y"),
                "monthKey": m_start.strftime("%Y-%m"),
                "expenses": str(m_exp),
                "income": str(m_inc),
                "netSavings": str(m_inc - m_exp),
            }
        )

    return {
        "period": {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
        },
        "summary": {
            "currentBalance": str(net_balance),
            "totalIncome": str(income_agg),
            "totalExpenses": str(expense_agg),
            "thisMonthSpending": str(this_month_spending),
            "budgetLimit": budget_limit,
            "remainingBudget": remaining_budget,
            "currency": getattr(user, "base_currency", "USD"),
        },
        "categoryBreakdown": category_breakdown,
        "monthlyTrends": monthly_trends,
    }
