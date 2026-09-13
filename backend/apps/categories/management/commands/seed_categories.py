from django.core.management.base import BaseCommand

from apps.categories.models import Category

SYSTEM_CATEGORIES = [
    # Expense Categories
    {"name": "Food & Dining", "type": "EXPENSE", "icon": "🍽️", "color": "#F59E0B"},
    {"name": "Transportation", "type": "EXPENSE", "icon": "🚗", "color": "#3B82F6"},
    {"name": "Housing & Rent", "type": "EXPENSE", "icon": "🏠", "color": "#EF4444"},
    {"name": "Utilities", "type": "EXPENSE", "icon": "⚡", "color": "#8B5CF6"},
    {"name": "Entertainment", "type": "EXPENSE", "icon": "🎬", "color": "#EC4899"},
    {"name": "Healthcare", "type": "EXPENSE", "icon": "🏥", "color": "#10B981"},
    {"name": "Shopping", "type": "EXPENSE", "icon": "🛍️", "color": "#06B6D4"},
    {"name": "Personal Care", "type": "EXPENSE", "icon": "💆", "color": "#F97316"},
    # Income Categories
    {"name": "Salary", "type": "INCOME", "icon": "💼", "color": "#10B981"},
    {"name": "Freelance", "type": "INCOME", "icon": "💻", "color": "#3B82F6"},
    {"name": "Investments", "type": "INCOME", "icon": "📈", "color": "#8B5CF6"},
    {"name": "Gifts & Grants", "type": "INCOME", "icon": "🎁", "color": "#EC4899"},
]


class Command(BaseCommand):
    help = "Seeds default system categories if they do not already exist."

    def handle(self, *args, **options):
        created_count = 0
        for cat_data in SYSTEM_CATEGORIES:
            cat, created = Category.objects.update_or_create(
                user=None,
                is_system=True,
                name=cat_data["name"],
                type=cat_data["type"],
                defaults={
                    "icon": cat_data["icon"],
                    "color": cat_data["color"],
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded system categories ({created_count} created, {len(SYSTEM_CATEGORIES) - created_count} already existed)."
            )
        )
