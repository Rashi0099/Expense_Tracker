from decimal import Decimal

from django.db import transaction
from django.db.models import F, Q
from rest_framework.exceptions import NotFound, ValidationError

from apps.categories.models import Category
from apps.income.models import Income
from apps.synchronization.models import Tombstone


def create_income(
    user,
    amount: Decimal,
    category_id: str,
    transaction_date,
    currency: str = "USD",
    source: str = None,
    payment_method: str = "BANK_TRANSFER",
    note: str = None,
    client_created_at=None,
    custom_id=None,
) -> Income:
    if amount <= 0:
        raise ValidationError({"amount": ["Amount must be greater than zero."]})

    category = Category.objects.filter(
        Q(is_system=True) | Q(user=user),
        id=category_id,
        is_archived=False,
    ).first()

    if not category:
        raise ValidationError({"categoryId": ["Invalid category or category is archived."]})

    if category.type != "INCOME":
        raise ValidationError({"categoryId": ["Selected category is not an Income category."]})

    with transaction.atomic():
        income_kwargs = {
            "user": user,
            "amount": amount,
            "currency": currency.upper(),
            "category": category,
            "transaction_date": transaction_date,
            "source": source or "",
            "payment_method": payment_method.upper(),
            "note": note or "",
            "client_created_at": client_created_at,
        }
        if custom_id:
            income_kwargs["id"] = custom_id

        income = Income.objects.create(**income_kwargs)

    return income


def update_income(income: Income, user, data: dict) -> Income:
    if income.user_id != user.id:
        raise NotFound("Income record not found.")

    with transaction.atomic():
        if "amount" in data:
            new_amount = Decimal(str(data["amount"]))
            if new_amount <= 0:
                raise ValidationError({"amount": ["Amount must be greater than zero."]})
            income.amount = new_amount

        if "categoryId" in data:
            cat = Category.objects.filter(
                Q(is_system=True) | Q(user=user),
                id=data["categoryId"],
            ).first()
            if not cat or cat.type != "INCOME":
                raise ValidationError({"categoryId": ["Invalid income category."]})
            income.category = cat

        if "transactionDate" in data:
            income.transaction_date = data["transactionDate"]
        if "source" in data:
            income.source = data["source"]
        if "paymentMethod" in data:
            income.payment_method = data["paymentMethod"].upper()
        if "note" in data:
            income.note = data["note"]

        income.version = F("version") + 1
        income.save()
        income.refresh_from_db()

    return income


def delete_income(income: Income, user):
    if income.user_id != user.id:
        raise NotFound("Income record not found.")

    with transaction.atomic():
        income_id = income.id
        income.delete()

        Tombstone.objects.create(
            user=user,
            entity_type="INCOME",
            entity_id=income_id,
            server_sequence=income.server_sequence,
        )
