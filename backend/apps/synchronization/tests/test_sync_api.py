from decimal import Decimal
import uuid
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.categories.models import Category
from apps.expenses.models import Expense
from apps.synchronization.models import SyncOperationLog, Tombstone
from apps.users.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user(db):
    return User.objects.create_user(email="synctest@example.com", password="password123")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="otheruser@example.com", password="password123")


@pytest.fixture
def system_category(db):
    return Category.objects.create(
        name="Food & Dining",
        type="EXPENSE",
        icon="🍔",
        color="#EF4444",
        is_system=True,
    )


@pytest.mark.django_db
class TestSyncAPI:
    def test_unauthenticated_request_rejected(self, api_client):
        res = api_client.post("/api/v1/sync/", {}, format="json")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_sync_push_create_expense(self, api_client, test_user, system_category):
        api_client.force_authenticate(user=test_user)
        device_id = str(uuid.uuid4())
        op_id = str(uuid.uuid4())
        expense_id = str(uuid.uuid4())

        payload = {
            "deviceId": device_id,
            "sinceSequence": 0,
            "operations": [
                {
                    "operationId": op_id,
                    "entityType": "EXPENSE",
                    "entityId": expense_id,
                    "operation": "CREATE",
                    "baseVersion": 0,
                    "payload": {
                        "amount": "45.50",
                        "currency": "USD",
                        "categoryId": str(system_category.id),
                        "transactionDate": "2026-09-13",
                        "paymentMethod": "CASH",
                        "payee": "Subway",
                        "note": "Lunch",
                    },
                }
            ],
        }

        res = api_client.post("/api/v1/sync/", payload, format="json")
        assert res.status_code == status.HTTP_200_OK
        data = res.data

        # Verify processed operations
        assert len(data["processedOperations"]) == 1
        proc = data["processedOperations"][0]
        assert proc["operationId"] == op_id
        assert proc["entityId"] == expense_id
        assert proc["status"] == "ACCEPTED"
        assert proc["serverVersion"] == 1
        assert proc["serverSequence"] == 1

        # Verify entity exists in DB
        expense = Expense.objects.get(id=expense_id)
        assert expense.user == test_user
        assert expense.amount == Decimal("45.50")
        assert expense.version == 1
        assert expense.server_sequence == 1

        # Verify sync operation log
        log = SyncOperationLog.objects.get(operation_id=op_id)
        assert log.user == test_user
        assert log.status == "ACCEPTED"

    def test_idempotent_duplicate_operation(self, api_client, test_user, system_category):
        api_client.force_authenticate(user=test_user)
        device_id = str(uuid.uuid4())
        op_id = str(uuid.uuid4())
        expense_id = str(uuid.uuid4())

        payload = {
            "deviceId": device_id,
            "sinceSequence": 0,
            "operations": [
                {
                    "operationId": op_id,
                    "entityType": "EXPENSE",
                    "entityId": expense_id,
                    "operation": "CREATE",
                    "baseVersion": 0,
                    "payload": {
                        "amount": "15.00",
                        "currency": "USD",
                        "categoryId": str(system_category.id),
                        "transactionDate": "2026-09-13",
                    },
                }
            ],
        }

        # First request
        res1 = api_client.post("/api/v1/sync/", payload, format="json")
        assert res1.status_code == status.HTTP_200_OK

        # Replay duplicate request
        res2 = api_client.post("/api/v1/sync/", payload, format="json")
        assert res2.status_code == status.HTTP_200_OK
        proc2 = res2.data["processedOperations"][0]
        assert proc2["operationId"] == op_id
        assert proc2["status"] == "ACCEPTED"

        # Assert no duplicate expense records
        assert Expense.objects.filter(id=expense_id).count() == 1

    def test_sync_push_update_and_conflict_detection(
        self, api_client, test_user, system_category
    ):
        api_client.force_authenticate(user=test_user)
        device_id = str(uuid.uuid4())
        expense_id = str(uuid.uuid4())

        # Create initially with version 1
        expense = Expense.objects.create(
            id=expense_id,
            user=test_user,
            category=system_category,
            amount=Decimal("50.00"),
            currency="USD",
            transaction_date="2026-09-13",
            version=1,
            server_sequence=1,
        )

        # Normal update with baseVersion = 1
        op1_id = str(uuid.uuid4())
        res1 = api_client.post(
            "/api/v1/sync/",
            {
                "deviceId": device_id,
                "sinceSequence": 0,
                "operations": [
                    {
                        "operationId": op1_id,
                        "entityType": "EXPENSE",
                        "entityId": expense_id,
                        "operation": "UPDATE",
                        "baseVersion": 1,
                        "payload": {"amount": "60.00", "note": "Updated amount"},
                    }
                ],
            },
            format="json",
        )
        assert res1.status_code == status.HTTP_200_OK
        assert res1.data["processedOperations"][0]["status"] == "ACCEPTED"
        assert res1.data["processedOperations"][0]["serverVersion"] == 2

        expense.refresh_from_db()
        assert expense.amount == Decimal("60.00")
        assert expense.version == 2

        # Stale update with baseVersion = 1 (current server is 2)
        op2_id = str(uuid.uuid4())
        res2 = api_client.post(
            "/api/v1/sync/",
            {
                "deviceId": device_id,
                "sinceSequence": 0,
                "operations": [
                    {
                        "operationId": op2_id,
                        "entityType": "EXPENSE",
                        "entityId": expense_id,
                        "operation": "UPDATE",
                        "baseVersion": 1,
                        "payload": {"amount": "55.00"},
                    }
                ],
            },
            format="json",
        )
        assert res2.status_code == status.HTTP_200_OK
        assert res2.data["processedOperations"][0]["status"] == "CONFLICT"
        assert res2.data["processedOperations"][0]["serverVersion"] == 3

    def test_sync_push_delete_and_tombstone(self, api_client, test_user, system_category):
        api_client.force_authenticate(user=test_user)
        device_id = str(uuid.uuid4())
        expense_id = str(uuid.uuid4())
        op_id = str(uuid.uuid4())

        expense = Expense.objects.create(
            id=expense_id,
            user=test_user,
            category=system_category,
            amount=Decimal("25.00"),
            currency="USD",
            transaction_date="2026-09-13",
            version=1,
            server_sequence=1,
        )

        res = api_client.post(
            "/api/v1/sync/",
            {
                "deviceId": device_id,
                "sinceSequence": 0,
                "operations": [
                    {
                        "operationId": op_id,
                        "entityType": "EXPENSE",
                        "entityId": expense_id,
                        "operation": "DELETE",
                        "baseVersion": 1,
                        "payload": {},
                    }
                ],
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["processedOperations"][0]["status"] == "ACCEPTED"

        # Verify expense soft deleted
        assert Expense.objects.filter(id=expense_id).count() == 0
        assert Expense.all_objects.filter(id=expense_id).first().is_deleted

        # Verify tombstone created
        tombstone = Tombstone.objects.get(entity_id=expense_id)
        assert tombstone.user == test_user
        assert tombstone.entity_type == "EXPENSE"

    def test_incremental_delta_pull(self, api_client, test_user, system_category):
        api_client.force_authenticate(user=test_user)
        device_id = str(uuid.uuid4())

        # Create two expenses with sequences 5 and 10
        Expense.objects.create(
            id=uuid.uuid4(),
            user=test_user,
            category=system_category,
            amount=Decimal("10.00"),
            currency="USD",
            transaction_date="2026-09-10",
            version=1,
            server_sequence=5,
        )
        e2 = Expense.objects.create(
            id=uuid.uuid4(),
            user=test_user,
            category=system_category,
            amount=Decimal("20.00"),
            currency="USD",
            transaction_date="2026-09-11",
            version=1,
            server_sequence=10,
        )

        # Pull deltas since sequence 6
        res = api_client.post(
            "/api/v1/sync/",
            {"deviceId": device_id, "sinceSequence": 6, "operations": []},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        server_expenses = res.data["serverChanges"]["expenses"]
        assert len(server_expenses) == 1
        assert server_expenses[0]["id"] == str(e2.id)

    def test_idor_isolation_between_users(
        self, api_client, test_user, other_user, system_category
    ):
        # User B creates an expense
        other_exp = Expense.objects.create(
            id=uuid.uuid4(),
            user=other_user,
            category=system_category,
            amount=Decimal("100.00"),
            currency="USD",
            transaction_date="2026-09-12",
            version=1,
            server_sequence=1,
        )

        # User A attempts to modify User B's expense
        api_client.force_authenticate(user=test_user)
        res = api_client.post(
            "/api/v1/sync/",
            {
                "deviceId": str(uuid.uuid4()),
                "sinceSequence": 0,
                "operations": [
                    {
                        "operationId": str(uuid.uuid4()),
                        "entityType": "EXPENSE",
                        "entityId": str(other_exp.id),
                        "operation": "UPDATE",
                        "baseVersion": 1,
                        "payload": {"amount": "999.00"},
                    }
                ],
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["processedOperations"][0]["status"] == "REJECTED"

        # User B's record remains unmodified
        other_exp.refresh_from_db()
        assert other_exp.amount == Decimal("100.00")
