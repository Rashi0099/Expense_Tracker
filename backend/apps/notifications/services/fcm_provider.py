import logging
import os
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class FCMProvider:
    """
    Enterprise-grade provider for Firebase Cloud Messaging (FCM) v1.
    Gracefully falls back to simulated delivery in local development and unit tests.
    """

    @classmethod
    def is_configured(cls) -> bool:
        from django.conf import settings
        if getattr(settings, "IS_TESTING", False) or os.environ.get("DJANGO_SETTINGS_MODULE") == "config.settings.testing":
            return False
        return bool(os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY") or os.environ.get("FIREBASE_CREDENTIALS_PATH"))

    @classmethod
    def send_to_token(
        cls,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Sends a push notification to a single FCM device registration token.
        """
        if not token:
            return {"status": "FAILED", "error": "Empty or missing push token"}

        data_payload = {str(k): str(v) for k, v in (data or {}).items()}

        if not cls.is_configured():
            logger.info(
                f"[FCM_SIMULATOR] Dispatched notification to token {token[:12]}...: '{title}' - '{body}'"
            )
            return {
                "status": "SIMULATED",
                "message_id": f"sim_{uuid.uuid4().hex[:16]}",
            }

        try:
            import firebase_admin
            from firebase_admin import messaging

            # Ensure firebase app is initialized
            if not firebase_admin._apps:
                cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
                if cred_path:
                    if not os.path.isabs(cred_path):
                        from django.conf import settings
                        cred_path = os.path.join(settings.BASE_DIR, cred_path)
                    if os.path.exists(cred_path):
                        cred = firebase_admin.credentials.Certificate(cred_path)
                        firebase_admin.initialize_app(cred)
                    else:
                        firebase_admin.initialize_app()
                else:
                    firebase_admin.initialize_app()

            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data_payload,
                token=token,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default",
                        click_action="OPEN_EXPENSE_APP",
                    ),
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound="default",
                            badge=1,
                        )
                    )
                ),
            )

            response = messaging.send(message)
            return {"status": "SENT", "message_id": response}

        except Exception as exc:
            err_str = str(exc)
            logger.error(f"[FCM] Failed to deliver push notification: {err_str}")
            is_unregistered = "registration-token-not-registered" in err_str.lower() or "not-registered" in err_str.lower()
            return {
                "status": "FAILED",
                "error": err_str,
                "unregistered": is_unregistered,
            }
