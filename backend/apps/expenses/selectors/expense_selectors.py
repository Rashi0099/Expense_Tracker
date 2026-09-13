from django.db.models import Q

from apps.expenses.models import Expense


def get_user_expenses(user, query_params: dict):
    """
    Constructs an optimized, filtered queryset strictly scoped to the authenticated user.
    Prevents IDOR and applies database-level filtering.
    """
    qs = Expense.objects.filter(user=user).select_related("category")

    category_id = query_params.get("category_id") or query_params.get("categoryId")
    if category_id:
        qs = qs.filter(category_id=category_id)

    date_from = query_params.get("date_from") or query_params.get("startDate")
    if date_from:
        qs = qs.filter(transaction_date__gte=date_from)

    date_to = query_params.get("date_to") or query_params.get("endDate")
    if date_to:
        qs = qs.filter(transaction_date__lte=date_to)

    min_amount = query_params.get("min_amount") or query_params.get("minAmount")
    if min_amount:
        qs = qs.filter(amount__gte=min_amount)

    max_amount = query_params.get("max_amount") or query_params.get("maxAmount")
    if max_amount:
        qs = qs.filter(amount__lte=max_amount)

    payment_method = query_params.get("payment_method") or query_params.get("paymentMethod")
    if payment_method:
        qs = qs.filter(payment_method=payment_method.upper())

    search = query_params.get("search")
    if search:
        qs = qs.filter(Q(payee__icontains=search) | Q(note__icontains=search))

    ordering = query_params.get("ordering", "-transaction_date")
    allowed_orderings = {
        "transaction_date",
        "-transaction_date",
        "amount",
        "-amount",
        "created_at",
        "-created_at",
    }
    if ordering in allowed_orderings:
        qs = qs.order_by(ordering)
    else:
        qs = qs.order_by("-transaction_date")

    return qs
