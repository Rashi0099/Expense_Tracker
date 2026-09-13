from django.contrib import admin

from apps.categories.models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "user", "is_system", "is_archived", "color")
    search_fields = ("name", "user__email")
    list_filter = ("type", "is_system", "is_archived")
    readonly_fields = ("id", "created_at", "updated_at")
