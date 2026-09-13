from decimal import Decimal

from rest_framework import serializers

from apps.budgets.models import Budget


class BudgetCreateSerializer(serializers.Serializer):
    categoryId = serializers.UUIDField(required=False, allow_null=True)
    periodStart = serializers.DateField()
    limitAmount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    currency = serializers.CharField(max_length=3, default="USD")

    def validate_periodStart(self, value):
        # Must be normalized to the 1st day of the month
        if value.day != 1:
            raise serializers.ValidationError(
                "periodStart must be the first day of the month (e.g. YYYY-MM-01)."
            )
        return value


class BudgetSerializer(serializers.ModelSerializer):
    categoryId = serializers.UUIDField(source="category_id", allow_null=True, required=False)
    categoryName = serializers.CharField(source="category.name", read_only=True, default=None)
    periodStart = serializers.DateField(source="period_start")
    limitAmount = serializers.DecimalField(
        source="limit_amount", max_digits=12, decimal_places=2, coerce_to_string=True
    )

    class Meta:
        model = Budget
        fields = [
            "id",
            "categoryId",
            "categoryName",
            "periodStart",
            "limitAmount",
            "currency",
            "version",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "version", "created_at", "updated_at"]


class BudgetConsumptionSerializer(serializers.Serializer):
    id = serializers.UUIDField(allow_null=True)
    categoryId = serializers.UUIDField(allow_null=True, required=False)
    categoryName = serializers.CharField(allow_null=True, required=False)
    categoryIcon = serializers.CharField(allow_null=True, required=False)
    categoryColor = serializers.CharField(allow_null=True, required=False)
    limitAmount = serializers.DecimalField(max_digits=12, decimal_places=2)
    spent = serializers.DecimalField(max_digits=12, decimal_places=2)
    remaining = serializers.DecimalField(max_digits=12, decimal_places=2)
    percentageUsed = serializers.FloatField()
    isOverBudget = serializers.BooleanField()


class BudgetOverviewSerializer(serializers.Serializer):
    period = serializers.CharField()
    overallBudget = BudgetConsumptionSerializer(allow_null=True)
    categoryBudgets = BudgetConsumptionSerializer(many=True)
