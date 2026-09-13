import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.authentication.jwt_auth import (
    generate_access_token,
    generate_raw_refresh_token,
    get_refresh_token_lifetime_seconds,
    hash_token,
)
from apps.authentication.models import Device, PhoneOTP, RefreshSession
from apps.authentication.services.sms_service import (
    generate_otp_code,
    normalize_indian_phone,
    send_otp_sms,
)

User = get_user_model()



def register_user(email: str, password: str, base_currency: str, device_data: dict):
    """Registers a new user and provisions their initial device and token pair."""
    email = email.lower().strip()
    if User.objects.filter(email=email).exists():
        raise ValidationError({"email": ["An account with this email address already exists."]})

    with transaction.atomic():
        user = User.objects.create_user(
            email=email,
            password=password,
            base_currency=base_currency,
        )

        device_id = device_data.get("id") or uuid.uuid4()
        device, _ = Device.objects.get_or_create(
            id=device_id,
            defaults={
                "user": user,
                "platform": device_data.get("platform", "WEB"),
                "device_name": device_data.get("deviceName", "Default Device"),
                "client_version": device_data.get("clientVersion", "1.0.0"),
            },
        )
        if device.user_id != user.id:
            device.user = user
            device.save(update_fields=["user"])

        # Generate tokens
        raw_refresh = generate_raw_refresh_token()
        token_hash = hash_token(raw_refresh)
        expires_at = timezone.now() + timedelta(seconds=get_refresh_token_lifetime_seconds())

        RefreshSession.objects.create(
            device=device,
            token_hash=token_hash,
            family_id=uuid.uuid4(),
            expires_at=expires_at,
        )

        access_token, expires_in = generate_access_token(user, str(device.id))

    return user, access_token, raw_refresh, expires_in


def login_user(email: str, password: str, device_data: dict):
    """Authenticates credentials, registers/updates device, and returns token pair."""
    email = email.lower().strip()
    user = User.objects.filter(email=email).first()

    if not user or not user.check_password(password):
        raise AuthenticationFailed("Invalid email or password.", code="INVALID_CREDENTIALS")

    if not user.is_active:
        raise AuthenticationFailed("This account has been deactivated.", code="ACCOUNT_DEACTIVATED")

    with transaction.atomic():
        device_id = device_data.get("id") or uuid.uuid4()
        device, created = Device.objects.get_or_create(
            id=device_id,
            defaults={
                "user": user,
                "platform": device_data.get("platform", "WEB"),
                "device_name": device_data.get("deviceName", "Default Device"),
                "client_version": device_data.get("clientVersion", "1.0.0"),
            },
        )
        if not created:
            device.user = user
            device.is_active = True
            device.device_name = device_data.get("deviceName", device.device_name)
            device.client_version = device_data.get("clientVersion", device.client_version)
            device.save(update_fields=["user", "is_active", "device_name", "client_version"])

        # Generate tokens
        raw_refresh = generate_raw_refresh_token()
        token_hash = hash_token(raw_refresh)
        expires_at = timezone.now() + timedelta(seconds=get_refresh_token_lifetime_seconds())

        RefreshSession.objects.create(
            device=device,
            token_hash=token_hash,
            family_id=uuid.uuid4(),
            expires_at=expires_at,
        )

        access_token, expires_in = generate_access_token(user, str(device.id))

    return user, access_token, raw_refresh, expires_in


def refresh_tokens(raw_refresh: str, device_id: str):
    """
    Executes Refresh Token Rotation (RTR).
    If an invalidated/already-used refresh token is presented, triggers reuse detection
    and revokes the entire session family.
    """
    token_hash = hash_token(raw_refresh)
    session = (
        RefreshSession.objects.select_related("device", "device__user")
        .filter(token_hash=token_hash)
        .first()
    )

    if not session:
        raise AuthenticationFailed("Invalid refresh token.", code="INVALID_REFRESH_TOKEN")

    if str(session.device_id) != str(device_id):
        raise AuthenticationFailed(
            "Device ID mismatch for refresh session.", code="DEVICE_MISMATCH"
        )

    # Reuse detection attack containment!
    if session.is_revoked:
        RefreshSession.objects.filter(family_id=session.family_id).update(is_revoked=True)
        session.device.is_active = False
        session.device.save(update_fields=["is_active"])
        raise AuthenticationFailed(
            "Refresh token reuse detected. All sessions in this family have been revoked for security.",
            code="TOKEN_REUSE_REVOKED",
        )

    if session.expires_at < timezone.now():
        session.is_revoked = True
        session.save(update_fields=["is_revoked"])
        raise AuthenticationFailed(
            "Refresh token has expired. Please log in again.", code="REFRESH_TOKEN_EXPIRED"
        )

    user = session.device.user
    if not user.is_active or not session.device.is_active:
        raise AuthenticationFailed(
            "Account or device session has been revoked.", code="SESSION_INACTIVE"
        )

    with transaction.atomic():
        # Invalidate the consumed token (Single-use invariant)
        session.is_revoked = True
        session.save(update_fields=["is_revoked"])

        # Issue new rotated refresh token in the same lineage family
        new_raw_refresh = generate_raw_refresh_token()
        new_token_hash = hash_token(new_raw_refresh)
        expires_at = timezone.now() + timedelta(seconds=get_refresh_token_lifetime_seconds())

        RefreshSession.objects.create(
            device=session.device,
            token_hash=new_token_hash,
            family_id=session.family_id,
            expires_at=expires_at,
        )

        access_token, expires_in = generate_access_token(user, str(session.device.id))

    return access_token, new_raw_refresh, expires_in


def logout_device(raw_refresh: str, device_id: str):
    """Revokes the refresh session matching the presented token and device."""
    token_hash = hash_token(raw_refresh)
    session = RefreshSession.objects.filter(token_hash=token_hash, device_id=device_id).first()
    if session:
        session.is_revoked = True
        session.save(update_fields=["is_revoked"])


def authenticate_or_register_phone_user(
    id_token: str,
    base_currency: str = "USD",
    device_data: dict = None,
):
    """
    Verifies Firebase ID token, resolves or registers user with their phone number,
    and returns authenticated user and JWT token pair.
    """
    device_data = device_data or {}

    # Allow simulated mock tokens for test suites and dev without active network call
    if id_token.startswith("mock-phone-token-"):
        parts = id_token.split("mock-phone-token-")
        phone_number = parts[1] if len(parts) > 1 and parts[1] else "+919999999999"
        firebase_uid = f"mock_uid_{phone_number.replace('+', '')}"
    else:
        import os
        import firebase_admin
        from firebase_admin import auth as fb_auth

        if not firebase_admin._apps:
            from django.conf import settings

            cred_path = getattr(settings, "FIREBASE_CREDENTIALS_PATH", None) or os.environ.get(
                "FIREBASE_CREDENTIALS_PATH"
            )
            if cred_path:
                if not os.path.isabs(cred_path):
                    cred_path = os.path.join(settings.BASE_DIR, cred_path)
                if os.path.exists(cred_path):
                    cred = firebase_admin.credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                else:
                    firebase_admin.initialize_app()
            else:
                firebase_admin.initialize_app()

        try:
            decoded = fb_auth.verify_id_token(id_token)
        except Exception as exc:
            raise AuthenticationFailed(
                f"Firebase token verification failed: {str(exc)}",
                code="INVALID_FIREBASE_TOKEN",
            )

        phone_number = decoded.get("phone_number")
        firebase_uid = decoded.get("uid")

    if not phone_number:
        raise ValidationError({"idToken": ["Token does not contain a verified phone number."]})

    phone_number = phone_number.strip()

    with transaction.atomic():
        user = User.objects.filter(
            models.Q(firebase_uid=firebase_uid) | models.Q(phone_number=phone_number)
        ).first()

        if not user:
            user = User.objects.create_user(
                phone_number=phone_number,
                firebase_uid=firebase_uid,
                base_currency=base_currency,
            )
        else:
            updated = False
            if not user.firebase_uid and firebase_uid:
                user.firebase_uid = firebase_uid
                updated = True
            if not user.phone_number and phone_number:
                user.phone_number = phone_number
                updated = True
            if updated:
                user.save(update_fields=["firebase_uid", "phone_number"])

        if not user.is_active:
            raise AuthenticationFailed(
                "This account has been deactivated.", code="ACCOUNT_DEACTIVATED"
            )

        device_id = device_data.get("id") or uuid.uuid4()
        device, created = Device.objects.get_or_create(
            id=device_id,
            defaults={
                "user": user,
                "platform": device_data.get("platform", "WEB"),
                "device_name": device_data.get("deviceName", "Default Device"),
                "client_version": device_data.get("clientVersion", "1.0.0"),
            },
        )
        if not created:
            device.user = user
            device.is_active = True
            device.device_name = device_data.get("deviceName", device.device_name)
            device.client_version = device_data.get("clientVersion", device.client_version)
            device.save(update_fields=["user", "is_active", "device_name", "client_version"])

        # Generate tokens
        raw_refresh = generate_raw_refresh_token()
        token_hash = hash_token(raw_refresh)
        expires_at = timezone.now() + timedelta(seconds=get_refresh_token_lifetime_seconds())

        RefreshSession.objects.create(
            device=device,
            token_hash=token_hash,
            family_id=uuid.uuid4(),
            expires_at=expires_at,
        )

        access_token, expires_in = generate_access_token(user, str(device.id))

    return user, access_token, raw_refresh, expires_in


def send_phone_otp(phone_number: str) -> dict:
    """
    Validates phone number, checks rate-limiting/cooldown, generates secure 6-digit OTP,
    stores it in PhoneOTP, and dispatches via Fast2SMS.
    """
    full_phone, _ = normalize_indian_phone(phone_number)

    now = timezone.now()
    # Check cooldown (30 seconds)
    recent_otp = (
        PhoneOTP.objects.filter(phone_number=full_phone)
        .order_by("-created_at")
        .first()
    )
    if recent_otp and (now - recent_otp.created_at).total_seconds() < 30:
        remaining = int(30 - (now - recent_otp.created_at).total_seconds())
        raise ValidationError(
            {"phoneNumber": [f"Please wait {remaining} seconds before requesting a new OTP."]}
        )

    # Hourly rate limiting (max 5 requests per hour)
    one_hour_ago = now - timedelta(hours=1)
    recent_count = PhoneOTP.objects.filter(
        phone_number=full_phone,
        created_at__gte=one_hour_ago,
    ).count()
    if recent_count >= 5:
        raise ValidationError(
            {"phoneNumber": ["Too many OTP requests. Please try again after 1 hour."]}
        )

    # For mock test numbers, fixed OTP is 123456
    if full_phone == "+919999999999":
        otp_code = "123456"
    else:
        otp_code = generate_otp_code()

    # Expires in 5 minutes
    expires_at = now + timedelta(minutes=5)
    PhoneOTP.objects.create(
        phone_number=full_phone,
        otp_code=otp_code,
        expires_at=expires_at,
    )

    # Send SMS via Fast2SMS gateway
    sms_res = send_otp_sms(full_phone, otp_code)

    return {
        "success": True,
        "message": "OTP sent successfully to your mobile number.",
        "phoneNumber": full_phone,
        "cooldown": 30,
        "expiresIn": 300,
        "simulated": sms_res.get("simulated", False),
    }


def verify_phone_otp(
    phone_number: str,
    otp: str,
    base_currency: str = "INR",
    device_data: dict = None,
):
    """
    Verifies 6-digit OTP code against PhoneOTP database records,
    registers new user or logs in existing user by phone_number,
    and returns authenticated user and JWT token pair.
    """
    device_data = device_data or {}
    full_phone, _ = normalize_indian_phone(phone_number)
    clean_otp = str(otp).strip()

    now = timezone.now()

    # Mock test number bypass
    if full_phone == "+919999999999" and clean_otp == "123456":
        pass
    else:
        otp_record = (
            PhoneOTP.objects.filter(
                phone_number=full_phone,
                is_verified=False,
                expires_at__gte=now,
            )
            .order_by("-created_at")
            .first()
        )

        if not otp_record:
            raise AuthenticationFailed(
                "Invalid or expired OTP. Please request a new code.",
                code="INVALID_OTP",
            )

        if otp_record.attempts >= 5:
            raise AuthenticationFailed(
                "Too many incorrect attempts. Please request a new OTP code.",
                code="OTP_ATTEMPTS_EXCEEDED",
            )

        # Allow dev fallback: if FAST2SMS_API_KEY is not set, allow 123456 or the generated OTP
        from django.conf import settings
        import os
        api_key = getattr(settings, "FAST2SMS_API_KEY", None) or os.environ.get("FAST2SMS_API_KEY", "")
        is_dev_mode = not api_key or api_key in ("dummy", "mock", "your_fast2sms_api_key_here")

        if otp_record.otp_code != clean_otp and not (is_dev_mode and clean_otp == "123456"):
            otp_record.attempts += 1
            otp_record.save(update_fields=["attempts"])
            raise AuthenticationFailed(
                "Incorrect verification code. Please try again.",
                code="INCORRECT_OTP",
            )

        otp_record.is_verified = True
        otp_record.save(update_fields=["is_verified"])

    with transaction.atomic():
        user = User.objects.filter(phone_number=full_phone).first()

        if not user:
            user = User.objects.create_user(
                phone_number=full_phone,
                base_currency=base_currency or "INR",
            )
        elif not user.is_active:
            raise AuthenticationFailed(
                "This account has been deactivated.", code="ACCOUNT_DEACTIVATED"
            )

        device_id = device_data.get("id") or uuid.uuid4()
        device, created = Device.objects.get_or_create(
            id=device_id,
            defaults={
                "user": user,
                "platform": device_data.get("platform", "WEB"),
                "device_name": device_data.get("deviceName", "Default Device"),
                "client_version": device_data.get("clientVersion", "1.0.0"),
            },
        )
        if not created:
            device.user = user
            device.is_active = True
            device.device_name = device_data.get("deviceName", device.device_name)
            device.client_version = device_data.get("clientVersion", device.client_version)
            device.save(update_fields=["user", "is_active", "device_name", "client_version"])

        # Generate tokens
        raw_refresh = generate_raw_refresh_token()
        token_hash = hash_token(raw_refresh)
        expires_at = timezone.now() + timedelta(seconds=get_refresh_token_lifetime_seconds())

        RefreshSession.objects.create(
            device=device,
            token_hash=token_hash,
            family_id=uuid.uuid4(),
            expires_at=expires_at,
        )

        access_token, expires_in = generate_access_token(user, str(device.id))

    return user, access_token, raw_refresh, expires_in


