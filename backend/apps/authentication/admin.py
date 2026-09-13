from django.contrib import admin

from apps.authentication.models import Device, RefreshSession


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("device_name", "platform", "user", "client_version", "is_active", "created_at")
    search_fields = ("device_name", "user__email")
    list_filter = ("platform", "is_active")
    readonly_fields = ("id", "created_at")


@admin.register(RefreshSession)
class RefreshSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "device", "family_id", "is_revoked", "expires_at", "created_at")
    search_fields = ("device__device_name", "family_id")
    list_filter = ("is_revoked",)
    readonly_fields = ("id", "token_hash", "created_at", "last_used_at")
