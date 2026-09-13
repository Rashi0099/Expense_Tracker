from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.authentication.jwt_auth import generate_access_token
from apps.authentication.models import Device
from apps.categories.models import Category
from apps.expenses.models import Expense
from apps.income.models import Income
from apps.synchronization.models import Tombstone
from apps.users.models import User


@pytest.mark.django_db
class TestDomainAPIs:
    def setup_method(self):
        self.user_a = User.objects.create_user(email="user_a@example.com", password="Password123!")
        self.device_a = Device.objects.create(
            user=self.user_a, platform="IOS", device_name="User A iPhone"
        )
        self.token_a, _ = generate_access_token(self.user_a, str(self.device_a.id))

        self.user_b = User.objects.create_user(email="user_b@example.com", password="Password123!")
        self.device_b = Device.objects.create(
            user=self.user_b, platform="ANDROID", device_name="User B Pixel"
        )
        self.token_b, _ = generate_access_token(self.user_b, str(self.device_b.id))

        self.client_a = APIClient()
        self.client_a.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")

        self.client_b = APIClient()
        self.client_b.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_b}")

        # Seed a system category and a user A category
        self.sys_cat = Category.objects.create(
            name="System Groceries",
            type="EXPENSE",
            is_system=True,
            color="#10B981",
        )
        self.user_a_cat = Category.objects.create(
            user=self.user_a,
            name="Coffee Shop",
            type="EXPENSE",
            is_system=False,
            color="#F59E0B",
        )
        self.salary_cat = Category.objects.create(
            name="Salary",
            type="INCOME",
            is_system=True,
            color="#3B82F6",
        )

    # 1. Categories Tests
    def test_category_list_and_create(self):
        resp = self.client_a.get(reverse("categories:category-list-create"))
        assert resp.status_code == 200
        names = [c["name"] for c in resp.json()]
        assert "System Groceries" in names
        assert "Coffee Shop" in names

        # User B should see System Groceries but NOT User A's custom category
        resp_b = self.client_b.get(reverse("categories:category-list-create"))
        names_b = [c["name"] for c in resp_b.json()]
        assert "System Groceries" in names_b
        assert "Coffee Shop" not in names_b

    def test_system_category_cannot_be_deleted(self):
        resp = self.client_a.delete(
            reverse("categories:category-detail", kwargs={"pk": self.sys_cat.id})
        )
        assert resp.status_code == 403

    # 2. Expenses CRUD & IDOR Protection Tests
    def test_expense_create_and_validation(self):
        payload = {
            "amount": "45.50",
            "currency": "USD",
            "categoryId": str(self.sys_cat.id),
            "transactionDate": "2026-09-13",
            "paymentMethod": "CREDIT_CARD",
            "payee": "Whole Foods",
            "note": "Groceries",
        }
        resp = self.client_a.post(reverse("expenses:expense-list-create"), payload, format="json")
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == "45.50"
        assert data["payee"] == "Whole Foods"

        # Negative amount validation
        invalid_payload = payload.copy()
        invalid_payload["amount"] = "-10.00"
        bad_resp = self.client_a.post(
            reverse("expenses:expense-list-create"), invalid_payload, format="json"
        )
        assert bad_resp.status_code == 400

    def test_idor_protection_cross_user_access_prevented(self):
        # User A creates expense
        exp_a = Expense.objects.create(
            user=self.user_a,
            category=self.sys_cat,
            amount=Decimal("150.00"),
            transaction_date=date(2026, 9, 13),
            payee="Secret Vendor",
        )

        # User B tries to read User A's expense
        resp_get = self.client_b.get(reverse("expenses:expense-detail", kwargs={"pk": exp_a.id}))
        assert resp_get.status_code == 404

        # User B tries to update User A's expense
        resp_patch = self.client_b.patch(
            reverse("expenses:expense-detail", kwargs={"pk": exp_a.id}),
            {"amount": "999.00"},
            format="json",
        )
        assert resp_patch.status_code == 404
        exp_a.refresh_from_db()
        assert exp_a.amount == Decimal("150.00")

        # User B tries to delete User A's expense
        resp_del = self.client_b.delete(reverse("expenses:expense-detail", kwargs={"pk": exp_a.id}))
        assert resp_del.status_code == 404
        assert Expense.objects.filter(id=exp_a.id).exists()

    def test_soft_delete_and_tombstone_emission(self):
        exp = Expense.objects.create(
            user=self.user_a,
            category=self.sys_cat,
            amount=Decimal("25.00"),
            transaction_date=date(2026, 9, 13),
        )
        del_resp = self.client_a.delete(reverse("expenses:expense-detail", kwargs={"pk": exp.id}))
        assert del_resp.status_code == 204

        # Verify excluded from normal queries
        assert Expense.objects.filter(id=exp.id).count() == 0
        # Verify still exists in all_objects with deleted_at
        soft_deleted = Expense.all_objects.get(id=exp.id)
        assert soft_deleted.deleted_at is not None

        # Verify Tombstone created for sync
        tombstone = Tombstone.objects.filter(user=self.user_a, entity_id=exp.id).first()
        assert tombstone is not None
        assert tombstone.entity_type == "EXPENSE"

    # 3. Income CRUD Tests
    def test_income_create_and_list(self):
        payload = {
            "amount": "5000.00",
            "currency": "USD",
            "categoryId": str(self.salary_cat.id),
            "transactionDate": "2026-09-01",
            "source": "Tech Corp",
            "paymentMethod": "BANK_TRANSFER",
        }
        resp = self.client_a.post(reverse("income:income-list-create"), payload, format="json")
        assert resp.status_code == 201
        assert resp.json()["amount"] == "5000.00"

    # 4. Budget Real-Time Consumption Calculations Tests
    def test_budget_creation_and_dynamic_consumption(self):
        # Create monthly overall budget ($1000)
        resp_b = self.client_a.post(
            reverse("budgets:budget-list-create"),
            {
                "periodStart": "2026-09-01",
                "limitAmount": "1000.00",
                "currency": "USD",
            },
            format="json",
        )
        assert resp_b.status_code == 201

        # Create Category budget for groceries ($400)
        resp_cat_b = self.client_a.post(
            reverse("budgets:budget-list-create"),
            {
                "categoryId": str(self.sys_cat.id),
                "periodStart": "2026-09-01",
                "limitAmount": "400.00",
                "currency": "USD",
            },
            format="json",
        )
        assert resp_cat_b.status_code == 201

        # Record expense for $150 in September
        Expense.objects.create(
            user=self.user_a,
            category=self.sys_cat,
            amount=Decimal("150.00"),
            transaction_date=date(2026, 9, 5),
        )

        # Query budget overview for September
        overview_resp = self.client_a.get(reverse("budgets:budget-list-create") + "?month=2026-09")
        assert overview_resp.status_code == 200
        data = overview_resp.json()

        # Overall: 1000 limit, 150 spent, 850 remaining, 15% used
        overall = data["overallBudget"]
        assert overall["limitAmount"] == "1000.00"
        assert overall["spent"] == "150.00"
        assert overall["remaining"] == "850.00"
        assert overall["percentageUsed"] == 15.0

        # Category: 400 limit, 150 spent, 250 remaining, 37.5% used
        cat_budget = data["categoryBudgets"][0]
        assert cat_budget["spent"] == "150.00"
        assert cat_budget["remaining"] == "250.00"
        assert cat_budget["percentageUsed"] == 37.5

    def test_expense_update_and_filtering(self):
        exp = Expense.objects.create(
            user=self.user_a,
            category=self.sys_cat,
            amount=Decimal("50.00"),
            transaction_date=date(2026, 9, 10),
            payee="Supermarket",
            note="Weekly groceries",
        )
        assert exp.version == 1

        # Patch expense
        patch_resp = self.client_a.patch(
            reverse("expenses:expense-detail", kwargs={"pk": exp.id}),
            {"amount": "75.00", "payee": "Supermarket Extra"},
            format="json",
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["amount"] == "75.00"
        assert patch_resp.json()["payee"] == "Supermarket Extra"
        assert patch_resp.json()["version"] == 2

        # Test filtering
        filter_resp = self.client_a.get(
            reverse("expenses:expense-list-create")
            + f"?startDate=2026-09-01&endDate=2026-09-15&categoryId={self.sys_cat.id}&search=Extra"
        )
        assert filter_resp.status_code == 200
        results = filter_resp.json()["results"]
        assert len(results) == 1
        assert results[0]["id"] == str(exp.id)

    def test_income_update_and_delete_with_tombstone(self):
        inc = Income.objects.create(
            user=self.user_a,
            category=self.salary_cat,
            amount=Decimal("3000.00"),
            transaction_date=date(2026, 9, 1),
            source="Primary Employer",
        )
        # Update
        patch_resp = self.client_a.patch(
            reverse("income:income-detail", kwargs={"pk": inc.id}),
            {"amount": "3500.00"},
            format="json",
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["amount"] == "3500.00"

        # Delete
        del_resp = self.client_a.delete(reverse("income:income-detail", kwargs={"pk": inc.id}))
        assert del_resp.status_code == 204
        assert not Income.objects.filter(id=inc.id).exists()
        assert Tombstone.objects.filter(
            user=self.user_a, entity_id=inc.id, entity_type="INCOME"
        ).exists()

    def test_custom_category_archive(self):
        del_resp = self.client_a.delete(
            reverse("categories:category-detail", kwargs={"pk": self.user_a_cat.id})
        )
        assert del_resp.status_code == 204
        archived_cat = Category.all_objects.get(id=self.user_a_cat.id)
        assert archived_cat.is_archived is True
        assert archived_cat.deleted_at is not None
        assert not Category.objects.filter(id=self.user_a_cat.id).exists()

        # User B cannot access User A's custom category
        resp_b = self.client_b.delete(
            reverse("categories:category-detail", kwargs={"pk": self.user_a_cat.id})
        )
        assert resp_b.status_code == 404

    # 5. Recurring Expenses Tests
    def test_recurring_expense_crud_and_isolation(self):
        payload = {
            "title": "Netflix Subscription",
            "amount": "15.99",
            "currency": "USD",
            "frequency": "MONTHLY",
            "categoryId": str(self.sys_cat.id),
            "startDate": "2026-09-01",
        }
        create_resp = self.client_a.post(
            reverse("recurring:recurring-list-create"), payload, format="json"
        )
        assert create_resp.status_code == 201
        rec_id = create_resp.json()["id"]
        assert create_resp.json()["title"] == "Netflix Subscription"

        # User A list
        list_resp = self.client_a.get(reverse("recurring:recurring-list-create"))
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 1

        # User B cannot access User A's recurring expense
        unauth_resp = self.client_b.get(
            reverse("recurring:recurring-detail", kwargs={"pk": rec_id})
        )
        assert unauth_resp.status_code == 404

        # User A updates
        patch_resp = self.client_a.patch(
            reverse("recurring:recurring-detail", kwargs={"pk": rec_id}),
            {"amount": "19.99", "isActive": False},
            format="json",
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["amount"] == "19.99"
        assert patch_resp.json()["isActive"] is False

        # User A deletes
        del_resp = self.client_a.delete(
            reverse("recurring:recurring-detail", kwargs={"pk": rec_id})
        )
        assert del_resp.status_code == 204

    # 6. Analytics Dashboard Metrics Tests
    def test_analytics_dashboard_metrics(self):
        # Create an income and expense in September 2026
        Income.objects.create(
            user=self.user_a,
            category=self.salary_cat,
            amount=Decimal("4000.00"),
            transaction_date=date(2026, 9, 1),
            source="Employer",
        )
        Expense.objects.create(
            user=self.user_a,
            category=self.sys_cat,
            amount=Decimal("250.00"),
            transaction_date=date(2026, 9, 10),
            payee="Grocery Store",
        )

        resp = self.client_a.get(
            reverse("analytics:dashboard-metrics") + "?startDate=2026-09-01&endDate=2026-09-30"
        )
        assert resp.status_code == 200
        data = resp.json()
        summary = data["summary"]
        assert summary["totalIncome"] == "4000.00"
        assert summary["totalExpenses"] == "250.00"
        assert summary["currentBalance"] == "3750.00"
        assert len(data["categoryBreakdown"]) >= 1
        assert data["categoryBreakdown"][0]["categoryName"] == "System Groceries"
