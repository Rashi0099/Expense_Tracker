from django.contrib import admin

from apps.income.models import Income


@admin.register(Income)
class IncomeAdmin(admin.ModelAdmin):
    list_display = (
        "source",
        "amount",
        "currency",
        "category",
        "transaction_date",
        "user",
        "payment_method",
    )
    search_fields = ("source", "note", "user__email")
    list_filter = ("currency", "payment_method", "transaction_date")
    readonly_fields = ("id", "created_at", "updated_at", "version", "server_sequence")
