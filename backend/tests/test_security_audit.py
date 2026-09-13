import os
import time
import uuid
from datetime import date
from decimal import Decimal

import jwt
import pytest
from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.authentication.jwt_auth import generate_access_token, get_jwt_signing_key
from apps.authentication.models import Device, RefreshSession
from apps.budgets.models import Budget
from apps.categories.models import Category
from apps.expenses.models import Expense
from apps.income.models import Income
from apps.recurring.models import RecurringExpense
from apps.users.models import User


@pytest.mark.django_db
class TestSecurityAuditSuite:
    """Comprehensive defensive security test suite covering OWASP Top 10 vulnerabilities."""

    def setup_method(self):
        self.client = APIClient()

        # Primary victim user
        self.user_a = User.objects.create_user(email="alice@security.com", password="Password12345!")
        self.device_a = Device.objects.create(
            user=self.user_a, platform="IOS", device_name="Alice iPhone"
        )
        self.token_a, _ = generate_access_token(self.user_a, str(self.device_a.id))

        # Adversary / attacker user
        self.user_b = User.objects.create_user(email="mallory@security.com", password="Password12345!")
        self.device_b = Device.objects.create(
            user=self.user_b, platform="ANDROID", device_name="Mallory Device"
        )
        self.token_b, _ = generate_access_token(self.user_b, str(self.device_b.id))

        self.client_a = APIClient()
        self.client_a.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")

        self.client_b = APIClient()
        self.client_b.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_b}")

        # Seed categories
        self.cat_expense = Category.objects.create(
            user=self.user_a, name="Alice Category", type="EXPENSE", color="#FF0000"
        )
        self.cat_income = Category.objects.create(
            user=self.user_a, name="Alice Income Cat", type="INCOME", color="#00FF00"
        )

    # -------------------------------------------------------------------------
    # 1. JWT & Cryptographic Security
    # -------------------------------------------------------------------------
    def test_tampered_jwt_signature_rejected(self):
        """Attacker modifies claims or signs with their own key — must be rejected."""
        fake_payload = {
            "iss": "https://api.expenseflow.com",
            "sub": str(self.user_a.id),
            "device_id": str(self.device_a.id),
            "token_type": "access",
            "iat": int(time.time()),
            "exp": int(time.time()) + 900,
            "jti": uuid.uuid4().hex,
        }
        tampered_token = jwt.encode(fake_payload, "completely-wrong-secret-key", algorithm="HS256")

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tampered_token}")
        resp = client.get(reverse("expenses:expense-list-create"))
        assert resp.status_code == 401

    def test_expired_jwt_rejected(self):
        """Expired access tokens must be rejected with 401."""
        expired_payload = {
            "iss": "https://api.expenseflow.com",
            "sub": str(self.user_a.id),
            "device_id": str(self.device_a.id),
            "token_type": "access",
            "iat": int(time.time()) - 2000,
            "exp": int(time.time()) - 500,  # Expired in past
            "jti": uuid.uuid4().hex,
        }
        expired_token = jwt.encode(expired_payload, get_jwt_signing_key(), algorithm="HS256")

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired_token}")
        resp = client.get(reverse("expenses:expense-list-create"))
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

    def test_none_algorithm_jwt_rejected(self):
        """JWT 'none' algorithm bypass attempt must fail."""
        header = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0"  # {"alg":"none","typ":"JWT"}
        payload = "eyJzdWIiOiIxMjM0NTY3ODkwIiwidG9rZW5fdHlwZSI6ImFjY2VzcyIsImV4cCI6OTk5OTk5OTk5OX0"
        none_token = f"{header}.{payload}."

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {none_token}")
        resp = client.get(reverse("expenses:expense-list-create"))
        assert resp.status_code == 401

    def test_deactivated_user_token_immediately_revoked(self):
        """If user is deactivated, valid unexpired access token must be rejected."""
        self.user_a.is_active = False
        self.user_a.save()

        resp = self.client_a.get(reverse("expenses:expense-list-create"))
        assert resp.status_code == 401

    def test_cross_device_refresh_rejected(self):
        """Refresh token presented with non-matching deviceId must be rejected."""
        reg_resp = self.client.post(
            reverse("authentication:register"),
            {"email": "device_check@example.com", "password": "Password12345!"},
            format="json",
        )
        refresh_token = reg_resp.json()["tokens"]["refreshToken"]

        # Present with attacker's spoofed device ID
        bad_resp = self.client.post(
            reverse("authentication:refresh"),
            {"refreshToken": refresh_token, "deviceId": str(uuid.uuid4())},
            format="json",
        )
        assert bad_resp.status_code == 401

    # -------------------------------------------------------------------------
    # 2. Insecure Direct Object References (IDOR) Protection
    # -------------------------------------------------------------------------
    def test_income_idor_protection(self):
        """User B cannot view, modify, or delete User A's income."""
        income_a = Income.objects.create(
            user=self.user_a,
            category=self.cat_income,
            amount=Decimal("3000.00"),
            transaction_date=date(2026, 9, 1),
            source="Salary",
        )

        # User B reads User A's income
        get_resp = self.client_b.get(reverse("income:income-detail", kwargs={"pk": income_a.id}))
        assert get_resp.status_code == 404

        # User B modifies User A's income
        patch_resp = self.client_b.patch(
            reverse("income:income-detail", kwargs={"pk": income_a.id}),
            {"amount": "99999.00"},
            format="json",
        )
        assert patch_resp.status_code == 404
        income_a.refresh_from_db()
        assert income_a.amount == Decimal("3000.00")

        # User B deletes User A's income
        del_resp = self.client_b.delete(reverse("income:income-detail", kwargs={"pk": income_a.id}))
        assert del_resp.status_code == 404
        assert Income.objects.filter(id=income_a.id).exists()

    def test_budget_idor_protection(self):
        """User B cannot view, modify, or delete User A's budget."""
        budget_a = Budget.objects.create(
            user=self.user_a,
            category=self.cat_expense,
            period_start=date(2026, 9, 1),
            limit_amount=Decimal("500.00"),
        )

        get_resp = self.client_b.get(reverse("budgets:budget-detail", kwargs={"pk": budget_a.id}))
        assert get_resp.status_code == 404

        patch_resp = self.client_b.patch(
            reverse("budgets:budget-detail", kwargs={"pk": budget_a.id}),
            {"limitAmount": "1.00"},
            format="json",
        )
        assert patch_resp.status_code == 404
        budget_a.refresh_from_db()
        assert budget_a.limit_amount == Decimal("500.00")

        del_resp = self.client_b.delete(reverse("budgets:budget-detail", kwargs={"pk": budget_a.id}))
        assert del_resp.status_code == 404
        assert Budget.objects.filter(id=budget_a.id).exists()

    def test_recurring_idor_protection(self):
        """User B cannot view, modify, or delete User A's recurring expense."""
        recurring_a = RecurringExpense.objects.create(
            user=self.user_a,
            category=self.cat_expense,
            title="Private Subscription",
            amount=Decimal("15.99"),
            frequency="MONTHLY",
            start_date=date(2026, 9, 1),
            next_due_date=date(2026, 10, 1),
        )

        get_resp = self.client_b.get(
            reverse("recurring:recurring-detail", kwargs={"pk": recurring_a.id})
        )
        assert get_resp.status_code == 404

        patch_resp = self.client_b.patch(
            reverse("recurring:recurring-detail", kwargs={"pk": recurring_a.id}),
            {"title": "Compromised"},
            format="json",
        )
        assert patch_resp.status_code == 404
        recurring_a.refresh_from_db()
        assert recurring_a.title == "Private Subscription"

        del_resp = self.client_b.delete(
            reverse("recurring:recurring-detail", kwargs={"pk": recurring_a.id})
        )
        assert del_resp.status_code == 404
        assert RecurringExpense.objects.filter(id=recurring_a.id).exists()

    # -------------------------------------------------------------------------
    # 3. SQL Injection Resistance
    # -------------------------------------------------------------------------
    def test_sql_injection_defense_in_search_queries(self):
        """Attacker injects SQL payloads into search queries — must not cause SQL error."""
        sql_injection_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE expenses; --",
            "1' UNION SELECT null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null --",
            "admin'--",
            "' OR 1=1 --",
        ]

        for payload in sql_injection_payloads:
            resp = self.client_a.get(
                reverse("expenses:expense-list-create"),
                {"search": payload},
            )
            # Response must be 200 OK with safe sanitized empty/filtered list, not 500
            assert resp.status_code == 200
            assert "results" in resp.json()

    # -------------------------------------------------------------------------
    # 4. Input Validation & Financial Boundaries
    # -------------------------------------------------------------------------
    def test_negative_and_zero_amounts_rejected(self):
        """Negative and zero amounts must be rejected on creation across all endpoints."""
        # Expense: zero amount
        resp1 = self.client_a.post(
            reverse("expenses:expense-list-create"),
            {
                "amount": "0.00",
                "categoryId": str(self.cat_expense.id),
                "transactionDate": "2026-09-13",
            },
            format="json",
        )
        assert resp1.status_code == 400

        # Expense: negative amount
        resp2 = self.client_a.post(
            reverse("expenses:expense-list-create"),
            {
                "amount": "-50.00",
                "categoryId": str(self.cat_expense.id),
                "transactionDate": "2026-09-13",
            },
            format="json",
        )
        assert resp2.status_code == 400

        # Income: zero amount
        resp3 = self.client_a.post(
            reverse("income:income-list-create"),
            {
                "amount": "0.00",
                "categoryId": str(self.cat_income.id),
                "transactionDate": "2026-09-13",
                "source": "Zero Work",
            },
            format="json",
        )
        assert resp3.status_code == 400

    def test_xss_payload_stored_safely_as_text(self):
        """XSS payloads in user input must be handled strictly as inert text, not executed."""
        xss_payload = "<script>alert('XSS_ATTACK');</script>"
        resp = self.client_a.post(
            reverse("expenses:expense-list-create"),
            {
                "amount": "12.50",
                "categoryId": str(self.cat_expense.id),
                "transactionDate": "2026-09-13",
                "payee": xss_payload,
                "note": xss_payload,
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["payee"] == xss_payload

        # Read back
        get_resp = self.client_a.get(reverse("expenses:expense-detail", kwargs={"pk": data["id"]}))
        assert get_resp.status_code == 200
        assert get_resp.json()["payee"] == xss_payload

    # -------------------------------------------------------------------------
    # 5. Production Security Headers Configuration Audit
    # -------------------------------------------------------------------------
    def test_production_security_settings_configuration(self):
        """Audits that config/settings/production.py implements all recommended OWASP headers."""
        import config.settings.production as prod_settings

        assert prod_settings.DEBUG is False
        assert prod_settings.SESSION_COOKIE_SECURE is True
        assert prod_settings.CSRF_COOKIE_SECURE is True
        assert prod_settings.SECURE_BROWSER_XSS_FILTER is True
        assert prod_settings.SECURE_CONTENT_TYPE_NOSNIFF is True
        assert prod_settings.X_FRAME_OPTIONS == "DENY"
        assert prod_settings.SECURE_HSTS_SECONDS >= 31536000  # At least 1 year
        assert prod_settings.SECURE_HSTS_INCLUDE_SUBDOMAINS is True
        assert prod_settings.SECURE_HSTS_PRELOAD is True
