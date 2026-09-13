from django.contrib import admin

from apps.recurring.models import RecurringExpense


@admin.register(RecurringExpense)
class RecurringExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "amount",
        "currency",
        "frequency",
        "next_due_date",
        "is_active",
        "user",
    )
    search_fields = ("title", "user__email")
    list_filter = ("frequency", "is_active")
    readonly_fields = ("id", "created_at", "updated_at")
