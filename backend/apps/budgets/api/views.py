from datetime import datetime

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.budgets.api.serializers import (
    BudgetCreateSerializer,
    BudgetOverviewSerializer,
    BudgetSerializer,
)
from apps.budgets.models import Budget
from apps.budgets.selectors.budget_selectors import get_monthly_budgets_with_consumption
from apps.categories.models import Category


class BudgetListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get monthly budgets with real-time consumption",
        responses={200: BudgetOverviewSerializer},
    )
    def get(self, request):
        month_param = request.query_params.get("month")
        if not month_param:
            target_date = datetime.utcnow().date().replace(day=1)
        else:
            try:
                target_date = datetime.strptime(month_param, "%Y-%m").date().replace(day=1)
            except ValueError:
                raise ValidationError({"month": ["Invalid month format. Expected YYYY-MM."]})

        data = get_monthly_budgets_with_consumption(request.user, target_date)
        return Response(data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create a monthly or category budget",
        request=BudgetCreateSerializer,
        responses={201: BudgetSerializer},
    )
    def post(self, request):
        serializer = BudgetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        category = None
        category_id = data.get("categoryId")
        if category_id:
            category = Category.objects.filter(id=category_id).first()
            if not category or (category.user_id and category.user_id != request.user.id):
                raise ValidationError({"categoryId": ["Invalid category."]})

        # Check for duplicates (enforce Step 2 uniqueness)
        existing = Budget.objects.filter(
            user=request.user,
            category=category,
            period_start=data["periodStart"],
        ).first()
        if existing:
            raise ValidationError(
                {
                    "periodStart": [
                        "A budget for this category/month period already exists. Update the existing record."
                    ]
                }
            )

        budget = Budget.objects.create(
            user=request.user,
            category=category,
            period_start=data["periodStart"],
            limit_amount=data["limitAmount"],
            currency=data.get("currency", "USD").upper(),
        )
        return Response(BudgetSerializer(budget).data, status=status.HTTP_201_CREATED)


class BudgetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_budget(self, pk, user):
        budget = Budget.objects.filter(id=pk, user=user).select_related("category").first()
        if not budget:
            raise NotFound("Budget not found.")
        return budget

    @extend_schema(summary="Retrieve budget details", responses={200: BudgetSerializer})
    def get(self, request, pk):
        budget = self._get_budget(pk, request.user)
        return Response(BudgetSerializer(budget).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update budget limit amount",
        request=BudgetSerializer,
        responses={200: BudgetSerializer},
    )
    def patch(self, request, pk):
        budget = self._get_budget(pk, request.user)
        new_amount = request.data.get("limitAmount")
        if new_amount is not None:
            budget.limit_amount = new_amount
            budget.save(update_fields=["limit_amount", "updated_at"])
        return Response(BudgetSerializer(budget).data, status=status.HTTP_200_OK)

    @extend_schema(summary="Delete budget", responses={204: None})
    def delete(self, request, pk):
        budget = self._get_budget(pk, request.user)
        budget.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
