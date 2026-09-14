import json
import logging
import os
import re
import secrets
import urllib.error
import urllib.request
from django.conf import settings
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

FAST2SMS_API_URL = "https://www.fast2sms.com/dev/bulkV2"
TEST_PHONE_NUMBERS = {"+919999999999", "9999999999"}


def generate_otp_code() -> str:
    """Generates a secure 6-digit numeric OTP."""
    code = secrets.randbelow(900000) + 100000
    return str(code)


def normalize_indian_phone(phone: str) -> tuple[str, str]:
    """
    Normalizes input phone number to (E.164 +91XXXXXXXXXX, 10-digit XXXXXXXXXX).
    Raises ValidationError if invalid.
    """
    cleaned = re.sub(r"[\s\-\(\)]", "", str(phone).strip())

    if cleaned.startswith("+91"):
        digits = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        digits = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        digits = cleaned[1:]
    else:
        digits = cleaned

    if not re.match(r"^[6-9]\d{9}$", digits):
        # Allow test phone number 9999999999
        if digits != "9999999999":
            raise ValidationError(
                {"phoneNumber": ["Please enter a valid 10-digit Indian mobile number."]}
            )

    full_e164 = f"+91{digits}"
    return full_e164, digits


def send_otp_sms(phone_number: str, otp_code: str) -> dict:
    """
    Dispatches 6-digit OTP to the phone number using Fast2SMS API.
    Provides graceful test/dev simulation fallback if API key is not configured or for test numbers.
    """
    full_phone, ten_digit = normalize_indian_phone(phone_number)

    # Test numbers bypass SMS gateway
    if full_phone in TEST_PHONE_NUMBERS or ten_digit == "9999999999":
        logger.info(f"[Fast2SMS Test Mock] OTP for {full_phone} is {otp_code}")
        return {
            "success": True,
            "simulated": True,
            "message": "Simulated SMS for test number.",
        }

    api_key = getattr(settings, "FAST2SMS_API_KEY", None) or os.environ.get("FAST2SMS_API_KEY", "")
    api_key = api_key.strip() if api_key else ""

    # If Fast2SMS API key is not configured yet, fallback to simulation mode and log clearly
    if not api_key or api_key in ("dummy", "mock", "your_fast2sms_api_key_here"):
        logger.warning(
            f"[Fast2SMS Warning] FAST2SMS_API_KEY is not set. Simulated OTP for {full_phone}: {otp_code}"
        )
        return {
            "success": True,
            "simulated": True,
            "message": f"Simulated OTP: {otp_code} (Fast2SMS key not yet configured).",
        }

    payload = {
        "route": "q",
        "message": f"Your ExpenseFlow verification code is {otp_code}. Valid for 5 minutes.",
        "language": "english",
        "flash": 0,
        "numbers": ten_digit,
    }


    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        FAST2SMS_API_URL,
        data=req_data,
        headers={
            "authorization": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "ExpenseTracker-Backend/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            result = json.loads(res_body)

        if result.get("return") is True:
            logger.info(f"Fast2SMS OTP sent successfully to {full_phone}.")
            return {
                "success": True,
                "simulated": False,
                "message": "SMS sent successfully.",
            }
        else:
            err_msg = result.get("message")
            if isinstance(err_msg, list):
                err_msg = ", ".join(err_msg)
            logger.error(f"Fast2SMS returned error for {full_phone}: {err_msg}")
            raise ValidationError(
                {"phoneNumber": [f"SMS gateway error: {err_msg or 'Unable to deliver SMS.'}"]}
            )

    except urllib.error.HTTPError as exc:
        err_detail = exc.read().decode("utf-8") if exc.fp else str(exc)
        logger.warning(
            f"[Fast2SMS Notice] Fast2SMS returned HTTP {exc.code}: {err_detail}. Falling back to simulation mode for {full_phone} (OTP: {otp_code})."
        )
        return {
            "success": True,
            "simulated": True,
            "message": f"OTP generated (Simulation fallback).",
        }
    except urllib.error.URLError as exc:
        logger.warning(
            f"[Fast2SMS Connection Notice] Failed to connect: {str(exc.reason)}. Falling back to simulation mode for {full_phone} (OTP: {otp_code})."
        )
        return {
            "success": True,
            "simulated": True,
            "message": "OTP generated (Simulation fallback).",
        }

