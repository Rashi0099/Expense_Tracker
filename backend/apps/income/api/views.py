from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.income.api.serializers import (
    IncomeCreateSerializer,
    IncomeSerializer,
    IncomeUpdateSerializer,
)
from apps.income.models import Income
from apps.income.selectors.income_selectors import get_user_income
from apps.income.services.income_services import (
    create_income,
    delete_income,
    update_income,
)
from common.pagination import StandardResultsSetPagination


class IncomeListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: IncomeSerializer(many=True)})
    def get(self, request):
        queryset = get_user_income(request.user, request.query_params)
        paginator = StandardResultsSetPagination()
        page_results = paginator.paginate_queryset(queryset, request)
        serializer = IncomeSerializer(page_results, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(request=IncomeCreateSerializer, responses={201: IncomeSerializer})
    def post(self, request):
        serializer = IncomeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        income = create_income(
            user=request.user,
            amount=data["amount"],
            currency=data.get("currency", "USD"),
            category_id=str(data["categoryId"]),
            transaction_date=data["transactionDate"],
            source=data.get("source"),
            payment_method=data.get("paymentMethod", "BANK_TRANSFER"),
            note=data.get("note"),
            client_created_at=data.get("clientCreatedAt"),
            custom_id=data.get("id"),
        )
        return Response(IncomeSerializer(income).data, status=status.HTTP_201_CREATED)


class IncomeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_income(self, pk, user):
        income = Income.objects.filter(id=pk, user=user).select_related("category").first()
        if not income:
            raise NotFound("Income record not found.")
        return income

    @extend_schema(responses={200: IncomeSerializer})
    def get(self, request, pk):
        income = self._get_income(pk, request.user)
        return Response(IncomeSerializer(income).data, status=status.HTTP_200_OK)

    @extend_schema(request=IncomeUpdateSerializer, responses={200: IncomeSerializer})
    def patch(self, request, pk):
        income = self._get_income(pk, request.user)
        serializer = IncomeUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = update_income(income, request.user, serializer.validated_data)
        return Response(IncomeSerializer(updated).data, status=status.HTTP_200_OK)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        income = self._get_income(pk, request.user)
        delete_income(income, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
