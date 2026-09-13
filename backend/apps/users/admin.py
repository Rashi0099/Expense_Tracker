from django.contrib import admin

from apps.users.models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "base_currency", "is_active", "is_staff", "created_at")
    search_fields = ("email",)
    list_filter = ("is_active", "is_staff", "base_currency")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)
