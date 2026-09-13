from decimal import Decimal

from django.db import transaction
from django.db.models import F, Q
from rest_framework.exceptions import NotFound, ValidationError

from apps.categories.models import Category
from apps.expenses.models import Expense
from apps.synchronization.models import Tombstone


def create_expense(
    user,
    amount: Decimal,
    category_id: str,
    transaction_date,
    currency: str = "USD",
    payment_method: str = "CASH",
    payee: str = None,
    note: str = None,
    client_created_at=None,
    custom_id=None,
) -> Expense:
    """Creates an expense record with atomic transaction boundary and category validation."""
    if amount <= 0:
        raise ValidationError({"amount": ["Amount must be greater than zero."]})

    category = Category.objects.filter(
        Q(is_system=True) | Q(user=user),
        id=category_id,
        is_archived=False,
    ).first()

    if not category:
        raise ValidationError({"categoryId": ["Invalid category or category is archived."]})

    if category.type != "EXPENSE":
        raise ValidationError({"categoryId": ["Selected category is not an Expense category."]})

    with transaction.atomic():
        expense_kwargs = {
            "user": user,
            "amount": amount,
            "currency": currency.upper(),
            "category": category,
            "transaction_date": transaction_date,
            "payment_method": payment_method.upper(),
            "payee": payee or "",
            "note": note or "",
            "client_created_at": client_created_at,
        }
        if custom_id:
            expense_kwargs["id"] = custom_id

        expense = Expense.objects.create(**expense_kwargs)

    return expense


def update_expense(expense: Expense, user, data: dict) -> Expense:
    """Updates an existing expense, checking ownership and incrementing version."""
    if expense.user_id != user.id:
        raise NotFound("Expense not found.")

    with transaction.atomic():
        if "amount" in data:
            new_amount = Decimal(str(data["amount"]))
            if new_amount <= 0:
                raise ValidationError({"amount": ["Amount must be greater than zero."]})
            expense.amount = new_amount

        if "categoryId" in data:
            cat = Category.objects.filter(
                Q(is_system=True) | Q(user=user),
                id=data["categoryId"],
            ).first()
            if not cat or cat.type != "EXPENSE":
                raise ValidationError({"categoryId": ["Invalid expense category."]})
            expense.category = cat

        if "transactionDate" in data:
            expense.transaction_date = data["transactionDate"]
        if "paymentMethod" in data:
            expense.payment_method = data["paymentMethod"].upper()
        if "payee" in data:
            expense.payee = data["payee"]
        if "note" in data:
            expense.note = data["note"]

        expense.version = F("version") + 1
        expense.save()
        expense.refresh_from_db()

    return expense


def delete_expense(expense: Expense, user):
    """Soft-deletes an expense and emits a Tombstone record for sync propagation."""
    if expense.user_id != user.id:
        raise NotFound("Expense not found.")

    with transaction.atomic():
        expense_id = expense.id
        expense.delete()  # soft delete

        Tombstone.objects.create(
            user=user,
            entity_type="EXPENSE",
            entity_id=expense_id,
            server_sequence=expense.server_sequence,
        )
