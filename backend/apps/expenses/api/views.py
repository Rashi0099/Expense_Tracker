from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expenses.api.serializers import (
    ExpenseCreateSerializer,
    ExpenseSerializer,
    ExpenseUpdateSerializer,
)
from apps.expenses.models import Expense
from apps.expenses.selectors.expense_selectors import get_user_expenses
from apps.expenses.services.expense_services import (
    create_expense,
    delete_expense,
    update_expense,
)


class ExpenseListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ExpenseSerializer(many=True)})
    def get(self, request):
        queryset = get_user_expenses(request.user, request.query_params)
        from common.pagination import StandardResultsSetPagination

        paginator = StandardResultsSetPagination()
        page_results = paginator.paginate_queryset(queryset, request)
        serializer = ExpenseSerializer(page_results, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(request=ExpenseCreateSerializer, responses={201: ExpenseSerializer})
    def post(self, request):
        serializer = ExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        expense = create_expense(
            user=request.user,
            amount=data["amount"],
            currency=data.get("currency", "USD"),
            category_id=str(data["categoryId"]),
            transaction_date=data["transactionDate"],
            payment_method=data.get("paymentMethod", "CASH"),
            payee=data.get("payee"),
            note=data.get("note"),
            client_created_at=data.get("clientCreatedAt"),
            custom_id=data.get("id"),
        )
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


class ExpenseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_expense(self, pk, user):
        # Strict user scoping prevents IDOR
        expense = Expense.objects.filter(id=pk, user=user).select_related("category").first()
        if not expense:
            raise NotFound("Expense not found.")
        return expense

    @extend_schema(responses={200: ExpenseSerializer})
    def get(self, request, pk):
        expense = self._get_expense(pk, request.user)
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_200_OK)

    @extend_schema(request=ExpenseUpdateSerializer, responses={200: ExpenseSerializer})
    def patch(self, request, pk):
        expense = self._get_expense(pk, request.user)
        serializer = ExpenseUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = update_expense(expense, request.user, serializer.validated_data)
        return Response(ExpenseSerializer(updated).data, status=status.HTTP_200_OK)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        expense = self._get_expense(pk, request.user)
        delete_expense(expense, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
