from decimal import Decimal

from rest_framework import serializers

from apps.recurring.models import RecurringExpense


class RecurringExpenseSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    categoryId = serializers.UUIDField(source="category_id")
    categoryName = serializers.CharField(source="category.name", read_only=True)
    categoryColor = serializers.CharField(source="category.color", read_only=True)
    categoryIcon = serializers.CharField(source="category.icon", read_only=True)
    startDate = serializers.DateField(source="start_date")
    nextDueDate = serializers.DateField(source="next_due_date")
    endDate = serializers.DateField(source="end_date", required=False, allow_null=True)
    isActive = serializers.BooleanField(source="is_active", default=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = RecurringExpense
        fields = [
            "id",
            "title",
            "amount",
            "currency",
            "frequency",
            "categoryId",
            "categoryName",
            "categoryColor",
            "categoryIcon",
            "startDate",
            "nextDueDate",
            "endDate",
            "isActive",
            "createdAt",
        ]
        read_only_fields = ["id", "createdAt"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"endDate": ["End date cannot be before start date."]}
            )
        return attrs


class RecurringExpenseCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=100)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.CharField(max_length=3, default="USD")
    frequency = serializers.ChoiceField(choices=RecurringExpense.FREQUENCY_CHOICES)
    categoryId = serializers.UUIDField()
    startDate = serializers.DateField()
    nextDueDate = serializers.DateField(required=False)
    endDate = serializers.DateField(required=False, allow_null=True)
    isActive = serializers.BooleanField(default=True)
