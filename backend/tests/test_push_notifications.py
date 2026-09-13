import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.authentication.jwt_auth import generate_access_token
from apps.authentication.models import Device
from apps.budgets.models import Budget
from apps.categories.models import Category
from apps.expenses.models import Expense
from apps.notifications.models import NotificationLog
from apps.notifications.services.notification_evaluator import NotificationEvaluator
from apps.recurring.models import RecurringExpense
from apps.users.models import User


@pytest.mark.django_db
class TestCloudPushNotificationSystem:
    def setup_method(self):
        self.user_a = User.objects.create_user(email="notif_a@example.com", password="Password12345!")
        self.device_a = Device.objects.create(
            user=self.user_a, platform="ANDROID", device_name="Alice Phone", push_token="fcm_token_alice_123"
        )
        self.token_a, _ = generate_access_token(self.user_a, str(self.device_a.id))

        self.user_b = User.objects.create_user(email="notif_b@example.com", password="Password12345!")
        self.device_b = Device.objects.create(
            user=self.user_b, platform="IOS", device_name="Bob iPhone", push_token="fcm_token_bob_456"
        )
        self.token_b, _ = generate_access_token(self.user_b, str(self.device_b.id))

        self.client_a = APIClient()
        self.client_a.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")

        self.client_b = APIClient()
        self.client_b.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_b}")

        self.cat_expense = Category.objects.create(
            user=self.user_a, name="Bills", type="EXPENSE", color="#F59E0B"
        )

    def test_register_push_token_success(self):
        """User registers or updates push token for their device."""
        new_token = "new_fcm_registration_token_999"
        resp = self.client_a.post(
            reverse("notifications:register-push-token"),
            {"deviceId": str(self.device_a.id), "pushToken": new_token},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "SUCCESS"

        self.device_a.refresh_from_db()
        assert self.device_a.push_token == new_token
        assert self.device_a.push_token_updated_at is not None

    def test_register_push_token_auto_provisions_device(self):
        """Registering push token for a new device ID automatically binds it to authenticated user."""
        fresh_device_id = uuid.uuid4()
        resp = self.client_a.post(
            reverse("notifications:register-push-token"),
            {"deviceId": str(fresh_device_id), "pushToken": "fresh_device_token"},
            format="json",
        )
        assert resp.status_code == 200

        dev = Device.objects.get(id=fresh_device_id)
        assert dev.user == self.user_a
        assert dev.push_token == "fresh_device_token"

    def test_recurring_bill_due_evaluation_and_deduplication(self):
        """Recurring expenses due today trigger Cloud Push alerts and prevent duplicate spam."""
        today = date(2026, 9, 13)

        recurring = RecurringExpense.objects.create(
            user=self.user_a,
            category=self.cat_expense,
            title="Electric Utility Bill",
            amount=Decimal("120.00"),
            frequency="MONTHLY",
            start_date=date(2026, 8, 13),
            next_due_date=today,
            is_active=True,
        )

        # 1. First evaluation: Alert must be generated
        logs = NotificationEvaluator.evaluate_recurring_due_alerts(target_date=today)
        assert len(logs) == 1
        log = logs[0]
        assert log.notification_type == "RECURRING_DUE"
        assert log.user == self.user_a
        assert "Electric Utility Bill" in log.body
        assert "$120.00" in log.body
        assert log.status == "SIMULATED"

        # 2. Second evaluation on same day: Must be deduplicated (zero duplicate alerts!)
        logs_repeat = NotificationEvaluator.evaluate_recurring_due_alerts(target_date=today)
        assert len(logs_repeat) == 0

    def test_budget_warning_and_exceeded_alerts_evaluation(self):
        """Budget consumption crossing 80% and 100% thresholds triggers alerts."""
        current_month = date(2026, 9, 13)
        period_start = date(2026, 9, 1)

        budget = Budget.objects.create(
            user=self.user_a,
            category=self.cat_expense,
            period_start=period_start,
            limit_amount=Decimal("100.00"),
        )

        # Scenario A: Spend $85.00 (85% - crosses 80% threshold)
        Expense.objects.create(
            user=self.user_a,
            category=self.cat_expense,
            amount=Decimal("85.00"),
            transaction_date=date(2026, 9, 5),
        )

        warning_logs = NotificationEvaluator.evaluate_budget_alerts(target_date=current_month)
        assert len(warning_logs) == 1
        assert warning_logs[0].notification_type == "BUDGET_WARNING"
        assert "85%" in warning_logs[0].body

        # Re-running: Deduplicated
        assert len(NotificationEvaluator.evaluate_budget_alerts(target_date=current_month)) == 0

        # Scenario B: Spend another $25.00 (Total $110.00, 110% - crosses 100% threshold)
        Expense.objects.create(
            user=self.user_a,
            category=self.cat_expense,
            amount=Decimal("25.00"),
            transaction_date=date(2026, 9, 10),
        )

        exceeded_logs = NotificationEvaluator.evaluate_budget_alerts(target_date=current_month)
        assert len(exceeded_logs) == 1
        assert exceeded_logs[0].notification_type == "BUDGET_EXCEEDED"
        assert "exceeded" in exceeded_logs[0].body

        # Re-running: Deduplicated
        assert len(NotificationEvaluator.evaluate_budget_alerts(target_date=current_month)) == 0

    def test_unregistered_token_automatically_cleaned_up(self):
        """If FCM indicates a device token is expired/unregistered, server removes it from device."""
        today = date(2026, 9, 13)
        RecurringExpense.objects.create(
            user=self.user_a,
            category=self.cat_expense,
            title="Old Service",
            amount=Decimal("10.00"),
            frequency="MONTHLY",
            start_date=date(2026, 8, 13),
            next_due_date=today,
            is_active=True,
        )

        with patch(
            "apps.notifications.services.fcm_provider.FCMProvider.send_to_token",
            return_value={"status": "FAILED", "error": "Token expired", "unregistered": True},
        ):
            NotificationEvaluator.evaluate_recurring_due_alerts(target_date=today)

        self.device_a.refresh_from_db()
        # Stale token cleared to prevent wasted future attempts
        assert self.device_a.push_token is None

    def test_notification_history_api(self):
        """User can fetch their own notification log history."""
        NotificationLog.objects.create(
            user=self.user_a,
            notification_type="RECURRING_DUE",
            stable_key="test_key_1",
            title="Test Title",
            body="Test Body",
            status="SENT",
        )

        resp = self.client_a.get(reverse("notifications:notification-history"))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Title"

        # User B should NOT see User A's notification history
        resp_b = self.client_b.get(reverse("notifications:notification-history"))
        assert resp_b.status_code == 200
        assert len(resp_b.json()) == 0
