from decimal import Decimal

from rest_framework import serializers

from apps.income.models import Income


class IncomeSerializer(serializers.ModelSerializer):
    categoryId = serializers.UUIDField(source="category_id")
    categoryName = serializers.CharField(source="category.name", read_only=True)
    transactionDate = serializers.DateField(source="transaction_date")
    paymentMethod = serializers.CharField(source="payment_method")
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Income
        fields = [
            "id",
            "amount",
            "currency",
            "categoryId",
            "categoryName",
            "transactionDate",
            "paymentMethod",
            "source",
            "note",
            "version",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = ["id", "version", "createdAt", "updatedAt"]


class IncomeCreateSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.CharField(max_length=3, default="USD")
    categoryId = serializers.UUIDField()
    transactionDate = serializers.DateField()
    paymentMethod = serializers.CharField(max_length=32, default="BANK_TRANSFER")
    source = serializers.CharField(max_length=100, allow_blank=True, required=False)
    note = serializers.CharField(allow_blank=True, required=False)
    clientCreatedAt = serializers.DateTimeField(required=False, allow_null=True)


class IncomeUpdateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
    categoryId = serializers.UUIDField(required=False)
    transactionDate = serializers.DateField(required=False)
    paymentMethod = serializers.CharField(max_length=32, required=False)
    source = serializers.CharField(max_length=100, allow_blank=True, required=False)
    note = serializers.CharField(allow_blank=True, required=False)
    baseVersion = serializers.IntegerField(required=False)
