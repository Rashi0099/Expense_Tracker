import hashlib
import os
import secrets
import time
import uuid

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()


def get_jwt_signing_key() -> str:
    return os.environ.get("JWT_SIGNING_KEY", settings.SECRET_KEY)


def get_access_token_lifetime_seconds() -> int:
    return int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", "15")) * 60


def get_refresh_token_lifetime_seconds() -> int:
    return int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", "30")) * 86400


def hash_token(raw_token: str) -> str:
    """Compute SHA-256 hash of a raw token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_raw_refresh_token() -> str:
    """Generate 64 bytes of cryptographically secure random token string."""
    return secrets.token_urlsafe(64)


def generate_access_token(user, device_id: str) -> tuple[str, int]:
    """
    Generate short-lived (15 min) stateless JWT access token.
    Returns (token_string, expires_in_seconds).
    """
    now = int(time.time())
    lifetime = get_access_token_lifetime_seconds()
    exp = now + lifetime

    payload = {
        "iss": "https://api.expenseflow.com",
        "sub": str(user.id),
        "device_id": str(device_id),
        "token_type": "access",
        "iat": now,
        "exp": exp,
        "jti": uuid.uuid4().hex,
    }

    token = jwt.encode(payload, get_jwt_signing_key(), algorithm="HS256")
    return token, lifetime


def decode_access_token(token_str: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token_str,
            get_jwt_signing_key(),
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub", "token_type"]},
        )
        if payload.get("token_type") != "access":
            raise AuthenticationFailed("Invalid token type.", code="INVALID_TOKEN_TYPE")
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed("Access token has expired.", code="TOKEN_EXPIRED")
    except jwt.InvalidTokenError:
        raise AuthenticationFailed("Invalid access token.", code="INVALID_TOKEN")


class JWTAuthentication(BaseAuthentication):
    """
    Stateless DRF authentication using Bearer JWT tokens.
    Verifies user identity without hitting the session database.
    """

    def authenticate(self, request):
        auth_header = get_authorization_header(request).split()

        if not auth_header:
            return None

        if len(auth_header) == 1:
            raise AuthenticationFailed(
                "Invalid token header. No credentials provided.", code="BAD_HEADER"
            )
        elif len(auth_header) > 2:
            raise AuthenticationFailed(
                "Invalid token header. Token string should not contain spaces.", code="BAD_HEADER"
            )

        prefix = auth_header[0].decode("utf-8")
        if prefix.lower() != "bearer":
            return None

        token_str = auth_header[1].decode("utf-8")
        payload = decode_access_token(token_str)

        user_id = payload.get("sub")
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            raise AuthenticationFailed(
                "User not found or account is deactivated.", code="USER_INACTIVE"
            )

        # Attach device_id from claims onto request for downstream services
        request.device_id = payload.get("device_id")

        return user, payload

    def authenticate_header(self, request):
        return 'Bearer realm="api"'


try:
    from drf_spectacular.extensions import OpenApiAuthenticationExtension

    class JWTAuthenticationScheme(OpenApiAuthenticationExtension):
        target_class = "apps.authentication.jwt_auth.JWTAuthentication"
        name = "BearerAuth"
        match_subclasses = True

        def get_security_requirement(self, auto_schema):
            return {self.name: []}

        def get_security_definition(self, auto_schema):
            return {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "Enter JWT access token with Bearer prefix: Bearer <token>",
            }

except ImportError:
    pass
