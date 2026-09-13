from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.categories.models import Category
from apps.recurring.api.serializers import (
    RecurringExpenseCreateSerializer,
    RecurringExpenseSerializer,
)
from apps.recurring.models import RecurringExpense


class RecurringExpenseListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: RecurringExpenseSerializer(many=True)})
    def get(self, request):
        recurring = (
            RecurringExpense.objects.filter(user=request.user)
            .select_related("category")
            .order_by("next_due_date")
        )
        serializer = RecurringExpenseSerializer(recurring, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        request=RecurringExpenseCreateSerializer,
        responses={201: RecurringExpenseSerializer},
    )
    def post(self, request):
        serializer = RecurringExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        category = Category.objects.filter(id=data["categoryId"]).first()
        if not category or (category.user_id and category.user_id != request.user.id):
            raise ValidationError({"categoryId": ["Invalid category."]})

        start_date = data["startDate"]
        next_due_date = data.get("nextDueDate") or start_date

        recurring = RecurringExpense.objects.create(
            user=request.user,
            category=category,
            title=data["title"],
            amount=data["amount"],
            currency=data.get("currency", "USD").upper(),
            frequency=data["frequency"],
            start_date=start_date,
            next_due_date=next_due_date,
            end_date=data.get("endDate"),
            is_active=data.get("isActive", True),
        )
        return Response(RecurringExpenseSerializer(recurring).data, status=status.HTTP_201_CREATED)


class RecurringExpenseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk, user):
        obj = RecurringExpense.objects.filter(id=pk, user=user).select_related("category").first()
        if not obj:
            raise NotFound("Recurring expense not found.")
        return obj

    @extend_schema(responses={200: RecurringExpenseSerializer})
    def get(self, request, pk):
        obj = self._get_object(pk, request.user)
        return Response(RecurringExpenseSerializer(obj).data, status=status.HTTP_200_OK)

    @extend_schema(responses={200: RecurringExpenseSerializer})
    def patch(self, request, pk):
        obj = self._get_object(pk, request.user)
        data = request.data

        if "title" in data:
            obj.title = data["title"]
        if "amount" in data:
            if float(data["amount"]) <= 0:
                raise ValidationError({"amount": ["Amount must be greater than zero."]})
            obj.amount = data["amount"]
        if "frequency" in data:
            obj.frequency = data["frequency"]
        if "isActive" in data:
            obj.is_active = bool(data["isActive"])
        if "nextDueDate" in data:
            obj.next_due_date = data["nextDueDate"]
        if "endDate" in data:
            obj.end_date = data["endDate"]
        if "categoryId" in data:
            cat = Category.objects.filter(id=data["categoryId"]).first()
            if not cat or (cat.user_id and cat.user_id != request.user.id):
                raise ValidationError({"categoryId": ["Invalid category."]})
            obj.category = cat

        obj.save()
        return Response(RecurringExpenseSerializer(obj).data, status=status.HTTP_200_OK)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        obj = self._get_object(pk, request.user)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
