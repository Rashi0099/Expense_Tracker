import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.authentication.models import RefreshSession
from apps.users.models import User


@pytest.mark.django_db
class TestAuthenticationAPI:
    def setup_method(self):
        self.client = APIClient()

    def test_registration_success(self):
        payload = {
            "email": "testuser@example.com",
            "password": "SuperSecretPassword123!",
            "baseCurrency": "USD",
            "device": {
                "platform": "IOS",
                "deviceName": "iPhone 15",
                "clientVersion": "1.0.0",
            },
        }
        response = self.client.post(reverse("authentication:register"), payload, format="json")
        assert response.status_code == 201
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "testuser@example.com"
        assert "tokens" in data
        assert "accessToken" in data["tokens"]
        assert "refreshToken" in data["tokens"]

        user = User.objects.get(email="testuser@example.com")
        assert user.check_password("SuperSecretPassword123!")

    def test_registration_duplicate_email_fails(self):
        User.objects.create_user(email="existing@example.com", password="Password123!")
        payload = {
            "email": "existing@example.com",
            "password": "NewPassword123!",
        }
        response = self.client.post(reverse("authentication:register"), payload, format="json")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"

    def test_login_success_and_failure(self):
        User.objects.create_user(email="loginuser@example.com", password="CorrectPassword123!")

        # Fail login
        fail_resp = self.client.post(
            reverse("authentication:login"),
            {"email": "loginuser@example.com", "password": "WrongPassword!"},
            format="json",
        )
        assert fail_resp.status_code == 401

        # Success login
        success_resp = self.client.post(
            reverse("authentication:login"),
            {"email": "loginuser@example.com", "password": "CorrectPassword123!"},
            format="json",
        )
        assert success_resp.status_code == 200
        assert "accessToken" in success_resp.json()["tokens"]

    def test_refresh_token_rotation_and_reuse_detection(self):
        # Register user and get initial tokens
        reg_resp = self.client.post(
            reverse("authentication:register"),
            {"email": "rtr@example.com", "password": "Password12345!"},
            format="json",
        )
        tokens = reg_resp.json()["tokens"]
        raw_refresh_1 = tokens["refreshToken"]
        user = User.objects.get(email="rtr@example.com")
        device = user.devices.first()

        # Refresh once (Legitimate)
        ref_resp_1 = self.client.post(
            reverse("authentication:refresh"),
            {"refreshToken": raw_refresh_1, "deviceId": str(device.id)},
            format="json",
        )
        assert ref_resp_1.status_code == 200
        raw_refresh_2 = ref_resp_1.json()["refreshToken"]
        assert raw_refresh_1 != raw_refresh_2

        # Verify old token is now marked is_revoked = True
        old_session = RefreshSession.objects.filter(device=device).first()
        assert old_session.is_revoked is True

        # Attacker replays raw_refresh_1!
        attack_resp = self.client.post(
            reverse("authentication:refresh"),
            {"refreshToken": raw_refresh_1, "deviceId": str(device.id)},
            format="json",
        )
        assert attack_resp.status_code == 401
        assert attack_resp.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

        # Check that entire family was killed
        active_sessions = RefreshSession.objects.filter(device=device, is_revoked=False).count()
        assert active_sessions == 0

    def test_me_profile_retrieve_and_patch(self):
        user = User.objects.create_user(
            email="me@example.com", password="Password123!", base_currency="USD"
        )
        device = user.devices.create(platform="WEB", device_name="Browser")
        from apps.authentication.jwt_auth import generate_access_token

        access_token, _ = generate_access_token(user, str(device.id))

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        get_resp = self.client.get(reverse("authentication:me"))
        assert get_resp.status_code == 200
        assert get_resp.json()["email"] == "me@example.com"
        assert get_resp.json()["baseCurrency"] == "USD"

        # Patch baseCurrency
        patch_resp = self.client.patch(
            reverse("authentication:me"), {"baseCurrency": "EUR"}, format="json"
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["baseCurrency"] == "EUR"
        user.refresh_from_db()
        assert user.base_currency == "EUR"

    def test_logout_revocation(self):
        reg_resp = self.client.post(
            reverse("authentication:register"),
            {"email": "logout@example.com", "password": "Password12345!"},
            format="json",
        )
        tokens = reg_resp.json()["tokens"]
        access_token = tokens["accessToken"]
        refresh_token = tokens["refreshToken"]
        user = User.objects.get(email="logout@example.com")
        device = user.devices.first()

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        logout_resp = self.client.post(
            reverse("authentication:logout"),
            {"refreshToken": refresh_token, "deviceId": str(device.id)},
            format="json",
        )
        assert logout_resp.status_code == 204
        session = RefreshSession.objects.filter(device=device).first()
        assert session.is_revoked is True

    def test_user_model_superuser_and_validation(self):
        super_u = User.objects.create_superuser(
            email="admin@example.com", password="AdminPassword123!"
        )
        assert super_u.is_staff is True
        assert super_u.is_superuser is True
        assert super_u.is_active is True

        from django.core.exceptions import ValidationError as DjangoValidationError

        with pytest.raises(DjangoValidationError):
            invalid_u = User(email="bad@example.com", base_currency="INVALID")
            invalid_u.full_clean()

    def test_phone_auth_registration_and_login(self):
        # 1. New user registration via phone OTP token
        payload = {
            "idToken": "mock-phone-token-+919876543210",
            "baseCurrency": "INR",
            "device": {
                "platform": "ANDROID",
                "deviceName": "Samsung Galaxy S24",
                "clientVersion": "1.0.0",
            },
        }
        response = self.client.post(reverse("authentication:phone-auth"), payload, format="json")
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["phoneNumber"] == "+919876543210"
        assert data["user"]["baseCurrency"] == "INR"
        assert "tokens" in data
        assert "accessToken" in data["tokens"]
        assert "refreshToken" in data["tokens"]

        user = User.objects.get(phone_number="+919876543210")
        assert user.firebase_uid == "mock_uid_919876543210"

        # 2. Existing user login via phone OTP token
        response2 = self.client.post(reverse("authentication:phone-auth"), payload, format="json")
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["user"]["phoneNumber"] == "+919876543210"
        assert User.objects.filter(phone_number="+919876543210").count() == 1

    def test_phone_auth_missing_token_fails(self):
        response = self.client.post(
            reverse("authentication:phone-auth"),
            {"baseCurrency": "USD"},
            format="json",
        )
        assert response.status_code == 400

