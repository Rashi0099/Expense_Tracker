from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.categories.api.serializers import CategoryCreateSerializer, CategorySerializer
from apps.categories.models import Category


class CategoryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CategorySerializer(many=True)})
    def get(self, request):
        category_type = request.query_params.get("type")
        include_archived = request.query_params.get("include_archived", "false").lower() == "true"

        qs = Category.objects.filter(Q(is_system=True) | Q(user=request.user))
        if category_type:
            qs = qs.filter(type=category_type.upper())
        if not include_archived:
            qs = qs.filter(is_archived=False)

        serializer = CategorySerializer(qs.order_by("name"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(request=CategoryCreateSerializer, responses={201: CategorySerializer})
    def post(self, request):
        serializer = CategoryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        parent = None
        parent_id = serializer.validated_data.get("parent_id")
        if parent_id:
            parent = Category.objects.filter(
                Q(is_system=True) | Q(user=request.user),
                id=parent_id,
            ).first()
            if not parent:
                raise NotFound("Parent category not found.")

        category = Category.objects.create(
            user=request.user,
            is_system=False,
            name=serializer.validated_data["name"],
            type=serializer.validated_data["type"],
            icon=serializer.validated_data.get("icon", "default"),
            color=serializer.validated_data.get("color", "#808080"),
            parent=parent,
        )
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)


class CategoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_category(self, pk, user):
        category = Category.objects.filter(
            Q(is_system=True) | Q(user=user),
            id=pk,
        ).first()
        if not category:
            raise NotFound("Category not found.")
        return category

    @extend_schema(responses={200: CategorySerializer})
    def get(self, request, pk):
        category = self._get_category(pk, request.user)
        return Response(CategorySerializer(category).data, status=status.HTTP_200_OK)

    @extend_schema(request=CategorySerializer, responses={200: CategorySerializer})
    def patch(self, request, pk):
        category = self._get_category(pk, request.user)
        if category.is_system:
            raise PermissionDenied("System default categories cannot be modified.")

        serializer = CategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        category = self._get_category(pk, request.user)
        if category.is_system:
            raise PermissionDenied("System default categories cannot be deleted.")

        # Soft archive to preserve historical transaction reports
        category.is_archived = True
        category.save(update_fields=["is_archived"])
        category.delete()  # sets deleted_at
        return Response(status=status.HTTP_204_NO_CONTENT)
