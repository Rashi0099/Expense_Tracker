from django.db.models import Q

from apps.income.models import Income


def get_user_income(user, query_params: dict):
    qs = Income.objects.filter(user=user).select_related("category")

    category_id = query_params.get("category_id") or query_params.get("categoryId")
    if category_id:
        qs = qs.filter(category_id=category_id)

    date_from = query_params.get("date_from") or query_params.get("startDate")
    if date_from:
        qs = qs.filter(transaction_date__gte=date_from)

    date_to = query_params.get("date_to") or query_params.get("endDate")
    if date_to:
        qs = qs.filter(transaction_date__lte=date_to)

    search = query_params.get("search")
    if search:
        qs = qs.filter(Q(source__icontains=search) | Q(note__icontains=search))

    ordering = query_params.get("ordering", "-transaction_date")
    allowed_orderings = {"transaction_date", "-transaction_date", "amount", "-amount"}
    if ordering in allowed_orderings:
        qs = qs.order_by(ordering)
    else:
        qs = qs.order_by("-transaction_date")

    return qs
