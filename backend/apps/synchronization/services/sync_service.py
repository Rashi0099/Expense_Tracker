from decimal import Decimal
from typing import Any, Dict, List, Optional
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.authentication.models import Device
from apps.budgets.models import Budget
from apps.categories.models import Category
from apps.expenses.models import Expense
from apps.income.models import Income
from apps.recurring.models import RecurringExpense
from apps.synchronization.models import SyncOperationLog, Tombstone, UserSyncSequence
from apps.synchronization.selectors.sync_selector import SyncSelector


class SyncService:
    @staticmethod
    def _allocate_next_sequence(user: Any) -> int:
        seq_obj, _ = UserSyncSequence.objects.select_for_update().get_or_create(
            user=user,
            defaults={"current_sequence": 0},
        )
        seq_obj.current_sequence += 1
        seq_obj.save(update_fields=["current_sequence", "updated_at"])
        return seq_obj.current_sequence

    @classmethod
    def process_sync_batch(
        cls,
        user: Any,
        device: Device,
        since_sequence: int,
        operations: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Atomically processes incoming push mutations and returns incremental server deltas."""
        processed_operations = []

        with transaction.atomic():
            for op in operations:
                op_id = op["operationId"]
                entity_type = op["entityType"]
                entity_id = op["entityId"]
                operation_type = op["operation"]
                base_version = op.get("baseVersion", 0)
                payload = op.get("payload", {})

                # 1. Idempotency Check
                existing_log = SyncOperationLog.objects.filter(
                    user=user, operation_id=op_id
                ).first()
                if existing_log:
                    processed_operations.append(
                        {
                            "operationId": str(op_id),
                            "entityId": str(entity_id),
                            "status": existing_log.status,
                            "serverVersion": existing_log.server_version,
                            "serverSequence": existing_log.server_sequence,
                            "reason": None,
                        }
                    )
                    continue

                # 2. Process according to entity type
                res = cls._process_entity_operation(
                    user=user,
                    device=device,
                    op_id=op_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    operation_type=operation_type,
                    base_version=base_version,
                    payload=payload,
                )
                processed_operations.append(res)

            # 3. Fetch incremental changes for the user
            server_changes = SyncSelector.get_server_changes(
                user=user, since_sequence=since_sequence
            )
            latest_sequence = SyncSelector.get_latest_sequence(user)

            # 4. Update device metadata
            device.last_sync_sequence = latest_sequence
            device.last_synced_at = timezone.now()
            device.save(update_fields=["last_sync_sequence", "last_synced_at"])

        return {
            "processedOperations": processed_operations,
            "serverChanges": server_changes,
            "latestServerSequence": latest_sequence,
            "hasMore": False,
        }

    @classmethod
    def _process_entity_operation(
        cls,
        user: Any,
        device: Device,
        op_id: Any,
        entity_type: str,
        entity_id: Any,
        operation_type: str,
        base_version: int,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        handler_map = {
            "EXPENSE": cls._handle_expense,
            "INCOME": cls._handle_income,
            "CATEGORY": cls._handle_category,
            "BUDGET": cls._handle_budget,
            "RECURRING": cls._handle_recurring,
        }

        handler = handler_map.get(entity_type)
        if not handler:
            return {
                "operationId": str(op_id),
                "entityId": str(entity_id),
                "status": "REJECTED",
                "serverVersion": 0,
                "serverSequence": 0,
                "reason": f"Unknown entity type: {entity_type}",
            }

        return handler(
            user=user,
            device=device,
            op_id=op_id,
            entity_id=entity_id,
            operation_type=operation_type,
            base_version=base_version,
            payload=payload,
        )

    # -------------------------------------------------------------------------
    # EXPENSE HANDLER
    # -------------------------------------------------------------------------
    @classmethod
    def _handle_expense(
        cls, user, device, op_id, entity_id, operation_type, base_version, payload
    ) -> Dict[str, Any]:
        if operation_type == "CREATE":
            existing = Expense.objects.filter(id=entity_id, user=user).first()
            if existing:
                return cls._log_op(
                    user, device, op_id, "EXPENSE", entity_id, operation_type,
                    existing.version, existing.server_sequence, "ACCEPTED"
                )

            cat_id = payload.get("categoryId")
            category = Category.objects.filter(id=cat_id).filter(
                Q(user=user) | Q(is_system=True)
            ).first()
            if not category:
                return {
                    "operationId": str(op_id),
                    "entityId": str(entity_id),
                    "status": "REJECTED",
                    "serverVersion": 0,
                    "serverSequence": 0,
                    "reason": "Category not found or access denied.",
                }

            seq = cls._allocate_next_sequence(user)
            expense = Expense.objects.create(
                id=entity_id,
                user=user,
                category=category,
                amount=Decimal(str(payload["amount"])),
                currency=payload.get("currency", "USD"),
                transaction_date=payload["transactionDate"],
                payment_method=payload.get("paymentMethod", "CASH"),
                payee=payload.get("payee") or "",
                note=payload.get("note") or "",
                version=1,
                server_sequence=seq,
                client_created_at=payload.get("clientCreatedAt"),
            )
            return cls._log_op(
                user, device, op_id, "EXPENSE", entity_id, operation_type,
                expense.version, seq, "ACCEPTED"
            )

        elif operation_type == "UPDATE":
            expense = Expense.objects.filter(id=entity_id, user=user).first()
            if not expense:
                return {
                    "operationId": str(op_id),
                    "entityId": str(entity_id),
                    "status": "REJECTED",
                    "serverVersion": 0,
                    "serverSequence": 0,
                    "reason": "Expense not found.",
                }

            is_conflict = base_version < expense.version
            if "categoryId" in payload:
                cat = Category.objects.filter(id=payload["categoryId"]).filter(
                    Q(user=user) | Q(is_system=True)
                ).first()
                if cat:
                    expense.category = cat
            if "amount" in payload:
                expense.amount = Decimal(str(payload["amount"]))
            if "currency" in payload:
                expense.currency = payload["currency"]
            if "transactionDate" in payload:
                expense.transaction_date = payload["transactionDate"]
            if "paymentMethod" in payload:
                expense.payment_method = payload["paymentMethod"]
            if "payee" in payload:
                expense.payee = payload["payee"] or ""
            if "note" in payload:
                expense.note = payload["note"] or ""

            seq = cls._allocate_next_sequence(user)
            expense.version += 1
            expense.server_sequence = seq
            expense.save()

            status = "CONFLICT" if is_conflict else "ACCEPTED"
            return cls._log_op(
                user, device, op_id, "EXPENSE", entity_id, operation_type,
                expense.version, seq, status
            )

        elif operation_type == "DELETE":
            expense = Expense.objects.filter(id=entity_id, user=user).first()
            seq = cls._allocate_next_sequence(user)
            if expense:
                expense.delete()

            Tombstone.objects.update_or_create(
                user=user,
                entity_id=entity_id,
                defaults={"entity_type": "EXPENSE", "server_sequence": seq},
            )
            return cls._log_op(
                user, device, op_id, "EXPENSE", entity_id, operation_type,
                base_version + 1, seq, "ACCEPTED"
            )

        return cls._rejected_op(op_id, entity_id, f"Invalid operation: {operation_type}")

    # -------------------------------------------------------------------------
    # INCOME HANDLER
    # -------------------------------------------------------------------------
    @classmethod
    def _handle_income(
        cls, user, device, op_id, entity_id, operation_type, base_version, payload
    ) -> Dict[str, Any]:
        if operation_type == "CREATE":
            existing = Income.objects.filter(id=entity_id, user=user).first()
            if existing:
                return cls._log_op(
                    user, device, op_id, "INCOME", entity_id, operation_type,
                    existing.version, existing.server_sequence, "ACCEPTED"
                )

            cat_id = payload.get("categoryId")
            category = Category.objects.filter(id=cat_id).filter(
                Q(user=user) | Q(is_system=True)
            ).first()
            if not category:
                return cls._rejected_op(op_id, entity_id, "Category not found or access denied.")

            seq = cls._allocate_next_sequence(user)
            inc = Income.objects.create(
                id=entity_id,
                user=user,
                category=category,
                amount=Decimal(str(payload["amount"])),
                currency=payload.get("currency", "USD"),
                transaction_date=payload["transactionDate"],
                payment_method=payload.get("paymentMethod", "BANK_TRANSFER"),
                source=payload.get("source") or "",
                note=payload.get("note") or "",
                version=1,
                server_sequence=seq,
                client_created_at=payload.get("clientCreatedAt"),
            )
            return cls._log_op(
                user, device, op_id, "INCOME", entity_id, operation_type,
                inc.version, seq, "ACCEPTED"
            )

        elif operation_type == "UPDATE":
            inc = Income.objects.filter(id=entity_id, user=user).first()
            if not inc:
                return cls._rejected_op(op_id, entity_id, "Income record not found.")

            is_conflict = base_version < inc.version
            if "categoryId" in payload:
                cat = Category.objects.filter(id=payload["categoryId"]).filter(
                    Q(user=user) | Q(is_system=True)
                ).first()
                if cat:
                    inc.category = cat
            if "amount" in payload:
                inc.amount = Decimal(str(payload["amount"]))
            if "currency" in payload:
                inc.currency = payload["currency"]
            if "transactionDate" in payload:
                inc.transaction_date = payload["transactionDate"]
            if "paymentMethod" in payload:
                inc.payment_method = payload["paymentMethod"]
            if "source" in payload:
                inc.source = payload["source"] or ""
            if "note" in payload:
                inc.note = payload["note"] or ""

            seq = cls._allocate_next_sequence(user)
            inc.version += 1
            inc.server_sequence = seq
            inc.save()

            status = "CONFLICT" if is_conflict else "ACCEPTED"
            return cls._log_op(
                user, device, op_id, "INCOME", entity_id, operation_type,
                inc.version, seq, status
            )

        elif operation_type == "DELETE":
            inc = Income.objects.filter(id=entity_id, user=user).first()
            seq = cls._allocate_next_sequence(user)
            if inc:
                inc.delete()

            Tombstone.objects.update_or_create(
                user=user,
                entity_id=entity_id,
                defaults={"entity_type": "INCOME", "server_sequence": seq},
            )
            return cls._log_op(
                user, device, op_id, "INCOME", entity_id, operation_type,
                base_version + 1, seq, "ACCEPTED"
            )

        return cls._rejected_op(op_id, entity_id, f"Invalid operation: {operation_type}")

    # -------------------------------------------------------------------------
    # CATEGORY HANDLER
    # -------------------------------------------------------------------------
    @classmethod
    def _handle_category(
        cls, user, device, op_id, entity_id, operation_type, base_version, payload
    ) -> Dict[str, Any]:
        if operation_type == "CREATE":
            existing = Category.objects.filter(id=entity_id).first()
            if existing:
                return cls._log_op(
                    user, device, op_id, "CATEGORY", entity_id, operation_type,
                    existing.version, existing.server_sequence, "ACCEPTED"
                )

            seq = cls._allocate_next_sequence(user)
            cat = Category.objects.create(
                id=entity_id,
                user=user,
                name=payload["name"],
                type=payload["type"],
                icon=payload.get("icon", "🏷️"),
                color=payload.get("color", "#808080"),
                is_system=False,
                version=1,
                server_sequence=seq,
            )
            return cls._log_op(
                user, device, op_id, "CATEGORY", entity_id, operation_type,
                cat.version, seq, "ACCEPTED"
            )

        elif operation_type == "UPDATE":
            cat = Category.objects.filter(id=entity_id, user=user).first()
            if not cat:
                return cls._rejected_op(op_id, entity_id, "Custom category not found.")

            is_conflict = base_version < cat.version
            if "name" in payload:
                cat.name = payload["name"]
            if "icon" in payload:
                cat.icon = payload["icon"]
            if "color" in payload:
                cat.color = payload["color"]
            if "isArchived" in payload:
                cat.is_archived = bool(payload["isArchived"])

            seq = cls._allocate_next_sequence(user)
            cat.version += 1
            cat.server_sequence = seq
            cat.save()

            status = "CONFLICT" if is_conflict else "ACCEPTED"
            return cls._log_op(
                user, device, op_id, "CATEGORY", entity_id, operation_type,
                cat.version, seq, status
            )

        elif operation_type == "DELETE":
            cat = Category.objects.filter(id=entity_id, user=user).first()
            if not cat:
                return cls._rejected_op(op_id, entity_id, "Custom category not found.")

            seq = cls._allocate_next_sequence(user)
            cat.delete()
            Tombstone.objects.update_or_create(
                user=user,
                entity_id=entity_id,
                defaults={"entity_type": "CATEGORY", "server_sequence": seq},
            )
            return cls._log_op(
                user, device, op_id, "CATEGORY", entity_id, operation_type,
                base_version + 1, seq, "ACCEPTED"
            )

        return cls._rejected_op(op_id, entity_id, f"Invalid operation: {operation_type}")

    # -------------------------------------------------------------------------
    # BUDGET HANDLER
    # -------------------------------------------------------------------------
    @classmethod
    def _handle_budget(
        cls, user, device, op_id, entity_id, operation_type, base_version, payload
    ) -> Dict[str, Any]:
        if operation_type == "CREATE":
            existing = Budget.objects.filter(id=entity_id, user=user).first()
            if existing:
                return cls._log_op(
                    user, device, op_id, "BUDGET", entity_id, operation_type,
                    existing.version, existing.server_sequence, "ACCEPTED"
                )

            cat = None
            if payload.get("categoryId"):
                cat = Category.objects.filter(id=payload["categoryId"]).filter(
                    Q(user=user) | Q(is_system=True)
                ).first()

            seq = cls._allocate_next_sequence(user)
            budget = Budget.objects.create(
                id=entity_id,
                user=user,
                category=cat,
                period_start=payload["periodStart"],
                limit_amount=Decimal(str(payload["limitAmount"])),
                currency=payload.get("currency", "USD"),
                version=1,
                server_sequence=seq,
            )
            return cls._log_op(
                user, device, op_id, "BUDGET", entity_id, operation_type,
                budget.version, seq, "ACCEPTED"
            )

        elif operation_type == "UPDATE":
            budget = Budget.objects.filter(id=entity_id, user=user).first()
            if not budget:
                return cls._rejected_op(op_id, entity_id, "Budget not found.")

            is_conflict = base_version < budget.version
            if "limitAmount" in payload:
                budget.limit_amount = Decimal(str(payload["limitAmount"]))
            if "currency" in payload:
                budget.currency = payload["currency"]

            seq = cls._allocate_next_sequence(user)
            budget.version += 1
            budget.server_sequence = seq
            budget.save()

            status = "CONFLICT" if is_conflict else "ACCEPTED"
            return cls._log_op(
                user, device, op_id, "BUDGET", entity_id, operation_type,
                budget.version, seq, status
            )

        elif operation_type == "DELETE":
            budget = Budget.objects.filter(id=entity_id, user=user).first()
            seq = cls._allocate_next_sequence(user)
            if budget:
                budget.delete()

            Tombstone.objects.update_or_create(
                user=user,
                entity_id=entity_id,
                defaults={"entity_type": "BUDGET", "server_sequence": seq},
            )
            return cls._log_op(
                user, device, op_id, "BUDGET", entity_id, operation_type,
                base_version + 1, seq, "ACCEPTED"
            )

        return cls._rejected_op(op_id, entity_id, f"Invalid operation: {operation_type}")

    # -------------------------------------------------------------------------
    # RECURRING EXPENSE HANDLER
    # -------------------------------------------------------------------------
    @classmethod
    def _handle_recurring(
        cls, user, device, op_id, entity_id, operation_type, base_version, payload
    ) -> Dict[str, Any]:
        if operation_type == "CREATE":
            existing = RecurringExpense.objects.filter(id=entity_id, user=user).first()
            if existing:
                return cls._log_op(
                    user, device, op_id, "RECURRING", entity_id, operation_type,
                    existing.version, existing.server_sequence, "ACCEPTED"
                )

            cat_id = payload.get("categoryId")
            category = Category.objects.filter(id=cat_id).filter(
                Q(user=user) | Q(is_system=True)
            ).first()
            if not category:
                return cls._rejected_op(op_id, entity_id, "Category not found or access denied.")

            seq = cls._allocate_next_sequence(user)
            rec = RecurringExpense.objects.create(
                id=entity_id,
                user=user,
                category=category,
                title=payload["title"],
                amount=Decimal(str(payload["amount"])),
                currency=payload.get("currency", "USD"),
                frequency=payload["frequency"],
                start_date=payload["startDate"],
                next_due_date=payload.get("nextDueDate") or payload["startDate"],
                end_date=payload.get("endDate"),
                is_active=payload.get("isActive", True),
                version=1,
                server_sequence=seq,
            )
            return cls._log_op(
                user, device, op_id, "RECURRING", entity_id, operation_type,
                rec.version, seq, "ACCEPTED"
            )

        elif operation_type == "UPDATE":
            rec = RecurringExpense.objects.filter(id=entity_id, user=user).first()
            if not rec:
                return cls._rejected_op(op_id, entity_id, "Recurring expense not found.")

            is_conflict = base_version < rec.version
            if "categoryId" in payload:
                cat = Category.objects.filter(id=payload["categoryId"]).filter(
                    Q(user=user) | Q(is_system=True)
                ).first()
                if cat:
                    rec.category = cat
            if "title" in payload:
                rec.title = payload["title"]
            if "amount" in payload:
                rec.amount = Decimal(str(payload["amount"]))
            if "currency" in payload:
                rec.currency = payload["currency"]
            if "frequency" in payload:
                rec.frequency = payload["frequency"]
            if "startDate" in payload:
                rec.start_date = payload["startDate"]
            if "nextDueDate" in payload:
                rec.next_due_date = payload["nextDueDate"]
            if "endDate" in payload:
                rec.end_date = payload["endDate"]
            if "isActive" in payload:
                rec.is_active = bool(payload["isActive"])

            seq = cls._allocate_next_sequence(user)
            rec.version += 1
            rec.server_sequence = seq
            rec.save()

            status = "CONFLICT" if is_conflict else "ACCEPTED"
            return cls._log_op(
                user, device, op_id, "RECURRING", entity_id, operation_type,
                rec.version, seq, status
            )

        elif operation_type == "DELETE":
            rec = RecurringExpense.objects.filter(id=entity_id, user=user).first()
            seq = cls._allocate_next_sequence(user)
            if rec:
                rec.delete()

            Tombstone.objects.update_or_create(
                user=user,
                entity_id=entity_id,
                defaults={"entity_type": "RECURRING", "server_sequence": seq},
            )
            return cls._log_op(
                user, device, op_id, "RECURRING", entity_id, operation_type,
                base_version + 1, seq, "ACCEPTED"
            )

        return cls._rejected_op(op_id, entity_id, f"Invalid operation: {operation_type}")

    # -------------------------------------------------------------------------
    # UTILITY HELPERS
    # -------------------------------------------------------------------------
    @classmethod
    def _log_op(
        cls, user, device, op_id, entity_type, entity_id, operation_type,
        server_version, server_sequence, status
    ) -> Dict[str, Any]:
        SyncOperationLog.objects.create(
            user=user,
            device=device,
            operation_id=op_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operation=operation_type,
            server_version=server_version,
            server_sequence=server_sequence,
            status=status,
        )
        return {
            "operationId": str(op_id),
            "entityId": str(entity_id),
            "status": status,
            "serverVersion": server_version,
            "serverSequence": server_sequence,
            "reason": None,
        }

    @classmethod
    def _rejected_op(cls, op_id, entity_id, reason: str) -> Dict[str, Any]:
        return {
            "operationId": str(op_id),
            "entityId": str(entity_id),
            "status": "REJECTED",
            "serverVersion": 0,
            "serverSequence": 0,
            "reason": reason,
        }
