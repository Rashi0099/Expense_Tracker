from rest_framework import serializers

from apps.categories.models import Category


class CategorySerializer(serializers.ModelSerializer):
    parentId = serializers.UUIDField(source="parent_id", allow_null=True, required=False)
    isSystem = serializers.BooleanField(source="is_system", read_only=True)
    isArchived = serializers.BooleanField(source="is_archived", required=False)

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "type",
            "parentId",
            "icon",
            "color",
            "isSystem",
            "isArchived",
            "version",
        ]
        read_only_fields = ["id", "isSystem", "version"]


class CategoryCreateSerializer(serializers.ModelSerializer):
    parentId = serializers.UUIDField(source="parent_id", allow_null=True, required=False)

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "type",
            "parentId",
            "icon",
            "color",
        ]
        read_only_fields = ["id"]
