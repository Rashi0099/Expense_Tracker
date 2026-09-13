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

    def test_phone_send_otp_success(self):
        from apps.authentication.models import PhoneOTP

        payload = {"phoneNumber": "+919778106863"}
        response = self.client.post(reverse("authentication:phone-send-otp"), payload, format="json")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["phoneNumber"] == "+919778106863"
        assert data["cooldown"] == 30

        otp_record = PhoneOTP.objects.filter(phone_number="+919778106863").first()
        assert otp_record is not None
        assert len(otp_record.otp_code) == 6

    def test_phone_send_otp_cooldown(self):
        payload = {"phoneNumber": "+919778106864"}
        resp1 = self.client.post(reverse("authentication:phone-send-otp"), payload, format="json")
        assert resp1.status_code == 200

        # Sending again immediately should trigger 30s cooldown
        resp2 = self.client.post(reverse("authentication:phone-send-otp"), payload, format="json")
        assert resp2.status_code == 400
        assert "Please wait" in str(resp2.json())

    def test_phone_verify_otp_new_and_existing_user(self):
        from apps.authentication.models import PhoneOTP

        # 1. Send OTP
        phone = "+919876543211"
        self.client.post(reverse("authentication:phone-send-otp"), {"phoneNumber": phone}, format="json")
        otp_record = PhoneOTP.objects.filter(phone_number=phone).first()

        # 2. Verify with correct OTP -> Registers new user
        verify_payload = {
            "phoneNumber": phone,
            "otp": otp_record.otp_code,
            "baseCurrency": "INR",
            "device": {
                "platform": "WEB",
                "deviceName": "Chrome Browser",
                "clientVersion": "1.0.0",
            },
        }
        res1 = self.client.post(reverse("authentication:phone-verify-otp"), verify_payload, format="json")
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["user"]["phoneNumber"] == phone
        assert data1["user"]["baseCurrency"] == "INR"
        assert "accessToken" in data1["tokens"]
        assert "refreshToken" in data1["tokens"]

        assert User.objects.filter(phone_number=phone).exists()

        # 3. Request new OTP and verify again -> Logs in existing user
        # Fast-forward created_at to bypass cooldown for test
        from django.utils import timezone
        from datetime import timedelta
        PhoneOTP.objects.filter(phone_number=phone).update(created_at=timezone.now() - timedelta(seconds=35))

        self.client.post(reverse("authentication:phone-send-otp"), {"phoneNumber": phone}, format="json")
        new_otp = PhoneOTP.objects.filter(phone_number=phone, is_verified=False).order_by("-created_at").first()

        verify_payload["otp"] = new_otp.otp_code
        res2 = self.client.post(reverse("authentication:phone-verify-otp"), verify_payload, format="json")
        assert res2.status_code == 200
        assert User.objects.filter(phone_number=phone).count() == 1

    def test_phone_verify_otp_wrong_code(self):
        from apps.authentication.models import PhoneOTP

        phone = "+919876543212"
        self.client.post(reverse("authentication:phone-send-otp"), {"phoneNumber": phone}, format="json")

        verify_payload = {
            "phoneNumber": phone,
            "otp": "000000",
        }
        res = self.client.post(reverse("authentication:phone-verify-otp"), verify_payload, format="json")
        assert res.status_code == 401

    def test_phone_verify_otp_test_number(self):
        # Test number +919999999999 with 123456 always succeeds without prior send
        verify_payload = {
            "phoneNumber": "+919999999999",
            "otp": "123456",
            "baseCurrency": "INR",
        }
        res = self.client.post(reverse("authentication:phone-verify-otp"), verify_payload, format="json")
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["phoneNumber"] == "+919999999999"
        assert "accessToken" in data["tokens"]


