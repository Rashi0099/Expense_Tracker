from django.contrib import admin

from apps.expenses.models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "payee",
        "amount",
        "currency",
        "category",
        "transaction_date",
        "user",
        "payment_method",
    )
    search_fields = ("payee", "note", "user__email")
    list_filter = ("currency", "payment_method", "transaction_date")
    readonly_fields = ("id", "created_at", "updated_at", "version", "server_sequence")
