from django.contrib import admin

from apps.budgets.models import Budget


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("category", "limit_amount", "currency", "period_start", "user")
    search_fields = ("user__email", "category__name")
    list_filter = ("period_start", "currency")
    readonly_fields = ("id", "created_at", "updated_at")
