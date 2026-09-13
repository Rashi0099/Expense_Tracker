from django.urls import path

from apps.authentication.api.views import (
    LoginView,
    LogoutView,
    MeView,
    PhoneAuthView,
    RefreshView,
    RegisterView,
    SendPhoneOTPView,
    VerifyPhoneOTPView,
)

app_name = "authentication"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("phone/", PhoneAuthView.as_view(), name="phone-auth"),
    path("phone/send-otp/", SendPhoneOTPView.as_view(), name="phone-send-otp"),
    path("phone/verify-otp/", VerifyPhoneOTPView.as_view(), name="phone-verify-otp"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
]

