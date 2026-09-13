from django.core.management.base import BaseCommand

from apps.categories.models import Category

SYSTEM_CATEGORIES = [
    # Expense Categories
    {"name": "Food & Dining", "type": "EXPENSE", "icon": "utensils", "color": "#F59E0B"},
    {"name": "Transportation", "type": "EXPENSE", "icon": "car", "color": "#3B82F6"},
    {"name": "Housing & Rent", "type": "EXPENSE", "icon": "home", "color": "#EF4444"},
    {"name": "Utilities", "type": "EXPENSE", "icon": "zap", "color": "#8B5CF6"},
    {"name": "Entertainment", "type": "EXPENSE", "icon": "film", "color": "#EC4899"},
    {"name": "Healthcare", "type": "EXPENSE", "icon": "activity", "color": "#10B981"},
    {"name": "Shopping", "type": "EXPENSE", "icon": "shopping-bag", "color": "#06B6D4"},
    {"name": "Personal Care", "type": "EXPENSE", "icon": "smile", "color": "#F97316"},
    # Income Categories
    {"name": "Salary", "type": "INCOME", "icon": "briefcase", "color": "#10B981"},
    {"name": "Freelance", "type": "INCOME", "icon": "laptop", "color": "#3B82F6"},
    {"name": "Investments", "type": "INCOME", "icon": "trending-up", "color": "#8B5CF6"},
    {"name": "Gifts & Grants", "type": "INCOME", "icon": "gift", "color": "#EC4899"},
]


class Command(BaseCommand):
    help = "Seeds default system categories if they do not already exist."

    def handle(self, *args, **options):
        created_count = 0
        for cat_data in SYSTEM_CATEGORIES:
            _, created = Category.objects.get_or_create(
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
