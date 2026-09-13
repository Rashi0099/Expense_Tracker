from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models

from common.models import BaseModel


class UserManager(BaseUserManager):
    """Custom manager for User model supporting email and phone number."""

    def create_user(self, email=None, phone_number=None, password=None, **extra_fields):
        if not email and not phone_number:
            raise ValueError("Either Email or Phone Number must be provided.")

        normalized_email = self.normalize_email(email).lower() if email else None
        normalized_phone = phone_number.strip() if phone_number else None

        user = self.model(
            email=normalized_email,
            phone_number=normalized_phone,
            **extra_fields,
        )
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email=email, password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """Custom User model using UUIDv7 primary key, supporting email or phone authentication."""

    email = models.EmailField(unique=True, null=True, blank=True, db_index=True, max_length=255)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    firebase_uid = models.CharField(max_length=128, unique=True, null=True, blank=True, db_index=True)
    base_currency = models.CharField(
        max_length=3,
        default="USD",
        validators=[
            RegexValidator(
                regex=r"^[A-Z]{3}$",
                message="Currency must be a valid 3-letter ISO 4217 code (e.g. USD, EUR, INR).",
            )
        ],
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(base_currency__regex=r"^[A-Z]{3}$"),
                name="chk_user_currency_iso",
            )
        ]

    def clean(self):
        super().clean()
        if not self.email:
            self.email = None
        if not self.phone_number:
            self.phone_number = None
        if not self.firebase_uid:
            self.firebase_uid = None

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.phone_number or self.email or str(self.id)
