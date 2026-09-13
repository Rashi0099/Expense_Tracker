from typing import Any, Dict

from apps.budgets.models import Budget
from apps.categories.models import Category
from apps.expenses.models import Expense
from apps.income.models import Income
from apps.recurring.models import RecurringExpense
from apps.synchronization.models import Tombstone, UserSyncSequence


class SyncSelector:
    @staticmethod
    def get_server_changes(user: Any, since_sequence: int) -> Dict[str, Any]:
        """Fetches all entity modifications and deletions strictly newer than since_sequence."""
        # 1. Expenses
        expenses_qs = (
            Expense.objects.filter(user=user, server_sequence__gt=since_sequence)
            .select_related("category")
            .order_by("server_sequence")
        )
        expenses_data = [
            {
                "id": str(e.id),
                "amount": str(e.amount),
                "currency": e.currency,
                "categoryId": str(e.category_id),
                "categoryName": e.category.name if e.category else None,
                "categoryColor": e.category.color if e.category else None,
                "categoryIcon": e.category.icon if e.category else None,
                "transactionDate": e.transaction_date.isoformat(),
                "paymentMethod": e.payment_method,
                "payee": e.payee or "",
                "note": e.note or "",
                "version": e.version,
                "serverSequence": e.server_sequence,
                "createdAt": e.created_at.isoformat(),
                "updatedAt": e.updated_at.isoformat(),
            }
            for e in expenses_qs
        ]

        # 2. Income
        income_qs = (
            Income.objects.filter(user=user, server_sequence__gt=since_sequence)
            .select_related("category")
            .order_by("server_sequence")
        )
        income_data = [
            {
                "id": str(i.id),
                "amount": str(i.amount),
                "currency": i.currency,
                "categoryId": str(i.category_id),
                "categoryName": i.category.name if i.category else None,
                "categoryColor": i.category.color if i.category else None,
                "categoryIcon": i.category.icon if i.category else None,
                "transactionDate": i.transaction_date.isoformat(),
                "paymentMethod": i.payment_method,
                "source": i.source or "",
                "note": i.note or "",
                "version": i.version,
                "serverSequence": i.server_sequence,
                "createdAt": i.created_at.isoformat(),
                "updatedAt": i.updated_at.isoformat(),
            }
            for i in income_qs
        ]

        # 3. Categories
        # If since_sequence == 0, fetch system categories + user categories
        if since_sequence == 0:
            categories_qs = Category.objects.filter(
                is_archived=False,
            ).filter(user__isnull=True) | Category.objects.filter(user=user, is_archived=False)
        else:
            categories_qs = Category.objects.filter(
                user=user, server_sequence__gt=since_sequence
            )
        categories_data = [
            {
                "id": str(c.id),
                "name": c.name,
                "type": c.type,
                "parentId": str(c.parent_id) if c.parent_id else None,
                "icon": c.icon,
                "color": c.color,
                "isSystem": c.is_system,
                "isArchived": c.is_archived,
                "version": c.version,
                "serverSequence": c.server_sequence,
            }
            for c in categories_qs
        ]

        # 4. Budgets
        budgets_qs = (
            Budget.objects.filter(user=user, server_sequence__gt=since_sequence)
            .select_related("category")
            .order_by("server_sequence")
        )
        budgets_data = [
            {
                "id": str(b.id),
                "categoryId": str(b.category_id) if b.category_id else None,
                "categoryName": b.category.name if b.category else None,
                "periodStart": b.period_start.isoformat(),
                "limitAmount": str(b.limit_amount),
                "currency": b.currency,
                "version": b.version,
                "serverSequence": b.server_sequence,
                "createdAt": b.created_at.isoformat(),
                "updatedAt": b.updated_at.isoformat(),
            }
            for b in budgets_qs
        ]

        # 5. Recurring Expenses
        recurring_qs = (
            RecurringExpense.objects.filter(user=user, server_sequence__gt=since_sequence)
            .select_related("category")
            .order_by("server_sequence")
        )
        recurring_data = [
            {
                "id": str(r.id),
                "title": r.title,
                "amount": str(r.amount),
                "currency": r.currency,
                "frequency": r.frequency,
                "categoryId": str(r.category_id),
                "categoryName": r.category.name if r.category else None,
                "categoryColor": r.category.color if r.category else None,
                "categoryIcon": r.category.icon if r.category else None,
                "startDate": r.start_date.isoformat(),
                "nextDueDate": r.next_due_date.isoformat(),
                "endDate": r.end_date.isoformat() if r.end_date else None,
                "isActive": r.is_active,
                "version": r.version,
                "serverSequence": r.server_sequence,
                "createdAt": r.created_at.isoformat(),
                "updatedAt": r.updated_at.isoformat(),
            }
            for r in recurring_qs
        ]

        # 6. Tombstones
        tombstones_qs = Tombstone.objects.filter(
            user=user, server_sequence__gt=since_sequence
        ).order_by("server_sequence")
        tombstones_data = [
            {
                "entityType": t.entity_type,
                "entityId": str(t.entity_id),
                "serverSequence": t.server_sequence,
                "deletedAt": t.deleted_at.isoformat(),
            }
            for t in tombstones_qs
        ]

        return {
            "expenses": expenses_data,
            "income": income_data,
            "categories": categories_data,
            "budgets": budgets_data,
            "recurring": recurring_data,
            "tombstones": tombstones_data,
        }

    @staticmethod
    def get_latest_sequence(user: Any) -> int:
        seq_obj = UserSyncSequence.objects.filter(user=user).first()
        return seq_obj.current_sequence if seq_obj else 0
