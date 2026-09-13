from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.notifications.services.notification_evaluator import NotificationEvaluator


class Command(BaseCommand):
    help = "Evaluates due recurring bills and budget limits, dispatching Cloud Push Notifications."

    def handle(self, *args, **options):
        today = timezone.now().date()
        self.stdout.write(f"Evaluating cloud push notifications for {today}...")

        recurring_logs = NotificationEvaluator.evaluate_recurring_due_alerts(today)
        self.stdout.write(
            self.style.SUCCESS(f"Recurring bill due alerts dispatched: {len(recurring_logs)}")
        )

        budget_logs = NotificationEvaluator.evaluate_budget_alerts(today)
        self.stdout.write(
            self.style.SUCCESS(f"Budget threshold alerts dispatched: {len(budget_logs)}")
        )

        total = len(recurring_logs) + len(budget_logs)
        self.stdout.write(self.style.SUCCESS(f"Completed! Total notifications created: {total}"))
