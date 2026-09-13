from datetime import date
from decimal import Decimal
from typing import List

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone

from apps.budgets.models import Budget
from apps.expenses.models import Expense
from apps.notifications.models import NotificationLog
from apps.notifications.services.fcm_provider import FCMProvider
from apps.recurring.models import RecurringExpense

User = get_user_model()


class NotificationEvaluator:
    """
    Evaluates business conditions across recurring subscriptions and budgets,
    dispatching deduplicated Cloud Push Notifications.
    """

    @classmethod
    def evaluate_recurring_due_alerts(cls, target_date: date = None) -> List[NotificationLog]:
        """
        Evaluates active recurring expenses due on or before target_date.
        Prevents repeated spam using stable_key deduplication.
        """
        if target_date is None:
            target_date = timezone.now().date()

        due_items = RecurringExpense.objects.filter(
            is_active=True,
            next_due_date__lte=target_date,
        ).select_related("user", "category")

        logs_created: List[NotificationLog] = []

        for item in due_items:
            user = item.user
            stable_key = f"rec_{item.id}_{item.next_due_date}"

            # 1. Deduplication check: Has this notification already been dispatched?
            if NotificationLog.objects.filter(user=user, stable_key=stable_key).exists():
                continue

            # 2. Find user's active devices with registered push tokens
            devices = user.devices.filter(is_active=True, push_token__isnull=False).exclude(push_token="")
            if not devices.exists():
                continue

            title = "Recurring Bill Due Today"
            formatted_amount = f"${item.amount:.2f}"
            body = f"Your scheduled payment for {item.title} ({formatted_amount}) is due today."
            payload = {
                "type": "RECURRING_DUE",
                "recurringId": str(item.id),
                "dueDate": item.next_due_date.isoformat(),
                "amount": str(item.amount),
                "currency": item.currency,
                "deepLink": f"expense-tracker://recurring/{item.id}",
            }

            for device in devices:
                result = FCMProvider.send_to_token(
                    token=device.push_token,
                    title=title,
                    body=body,
                    data=payload,
                )

                if result.get("unregistered"):
                    device.push_token = None
                    device.save(update_fields=["push_token"])

                log_entry = NotificationLog.objects.create(
                    user=user,
                    device=device,
                    notification_type="RECURRING_DUE",
                    stable_key=stable_key,
                    title=title,
                    body=body,
                    payload=payload,
                    status=result.get("status", "SENT"),
                    error_message=result.get("error"),
                )
                logs_created.append(log_entry)

        return logs_created

    @classmethod
    def evaluate_budget_alerts(cls, target_date: date = None) -> List[NotificationLog]:
        """
        Evaluates monthly budget consumption (>=80% warning and >=100% exceeded)
        and sends deduplicated alerts.
        """
        if target_date is None:
            target_date = timezone.now().date()

        current_month_str = target_date.strftime("%Y-%m")
        period_start = date(target_date.year, target_date.month, 1)

        budgets = Budget.objects.filter(period_start=period_start).select_related("user", "category")
        logs_created: List[NotificationLog] = []

        for budget in budgets:
            user = budget.user

            # Calculate total spent for this budget's category (or overall if category is null)
            expense_filter = {
                "user": user,
                "transaction_date__year": target_date.year,
                "transaction_date__month": target_date.month,
            }
            if budget.category_id:
                expense_filter["category_id"] = budget.category_id

            total_spent = Expense.objects.filter(**expense_filter).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

            if budget.limit_amount <= 0:
                continue

            percentage_used = int((total_spent / budget.limit_amount) * 100)

            threshold_type = None
            title = ""
            body = ""
            notif_type = ""
            if percentage_used >= 100:
                threshold_type = "exceeded_100"
                notif_type = "BUDGET_EXCEEDED"
                title = "Budget Limit Exceeded!"
                category_label = budget.category.name if budget.category else "Overall"
                body = f"You have exceeded your {category_label} budget by {percentage_used - 100}% (${total_spent:.2f} spent of ${budget.limit_amount:.2f})."
            elif percentage_used >= 80:
                threshold_type = "warning_80"
                notif_type = "BUDGET_WARNING"
                category_label = budget.category.name if budget.category else "Overall"
                body = f"You have reached {percentage_used}% of your {category_label} budget (${total_spent:.2f} spent of ${budget.limit_amount:.2f})."

            if not threshold_type:
                continue

            stable_key = f"budget_{budget.id}_{current_month_str}_{threshold_type}"

            # Deduplication
            if NotificationLog.objects.filter(user=user, stable_key=stable_key).exists():
                continue

            devices = user.devices.filter(is_active=True, push_token__isnull=False).exclude(push_token="")
            if not devices.exists():
                continue

            payload = {
                "type": notif_type,
                "budgetId": str(budget.id),
                "month": current_month_str,
                "percentageUsed": str(percentage_used),
                "deepLink": f"expense-tracker://budgets/{budget.id}",
            }

            for device in devices:
                result = FCMProvider.send_to_token(
                    token=device.push_token,
                    title=title,
                    body=body,
                    data=payload,
                )

                if result.get("unregistered"):
                    device.push_token = None
                    device.save(update_fields=["push_token"])

                log_entry = NotificationLog.objects.create(
                    user=user,
                    device=device,
                    notification_type=notif_type,
                    stable_key=stable_key,
                    title=title,
                    body=body,
                    payload=payload,
                    status=result.get("status", "SENT"),
                    error_message=result.get("error"),
                )
                logs_created.append(log_entry)

        return logs_created
