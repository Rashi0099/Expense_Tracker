from .base import *

DEBUG = False
IS_TESTING = True

# Accelerated password hasher for pytest execution
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

DATABASES["default"]["TEST"] = {
    "NAME": "test_expense_db",
}
