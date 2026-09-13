import uuid

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """
    Standardizes all DRF error responses into the immutable error envelope defined in Step 3.
    """
    response = exception_handler(exc, context)

    # Generate request trace ID
    request_id = f"req_{uuid.uuid4().hex[:24]}"
    now_iso = timezone.now().isoformat()

    if response is not None:
        if isinstance(exc, (APIException, Exception)) and exc.__class__.__name__ in (
            "AuthenticationFailed",
            "NotAuthenticated",
        ):
            response.status_code = status.HTTP_401_UNAUTHORIZED
            response.headers["WWW-Authenticate"] = "Bearer"

        error_code = getattr(exc, "default_code", "ERROR").upper()
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            error_code = "VALIDATION_FAILED"
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            error_code = "AUTHENTICATION_REQUIRED"
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            error_code = "PERMISSION_DENIED"
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            error_code = "NOT_FOUND"
        elif response.status_code == status.HTTP_409_CONFLICT:
            error_code = "RESOURCE_CONFLICT"

        details = []
        if isinstance(response.data, dict):
            for field, messages in response.data.items():
                if isinstance(messages, list):
                    for msg in messages:
                        details.append(
                            {
                                "field": field,
                                "issue": getattr(msg, "code", "invalid"),
                                "message": str(msg),
                            }
                        )
                elif isinstance(messages, str):
                    details.append(
                        {
                            "field": field,
                            "issue": "invalid",
                            "message": messages,
                        }
                    )
        elif isinstance(response.data, list):
            for item in response.data:
                details.append({"field": "non_field", "issue": "invalid", "message": str(item)})

        response.data = {
            "error": {
                "code": error_code,
                "message": (
                    getattr(exc, "detail", "An error occurred with your request.")
                    if isinstance(getattr(exc, "detail", None), str)
                    else "Request validation failed."
                ),
                "requestId": request_id,
                "timestamp": now_iso,
                "details": details,
            }
        }

    return response
