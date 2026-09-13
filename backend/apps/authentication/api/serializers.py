from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class DeviceMetadataSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False)
    platform = serializers.ChoiceField(choices=["IOS", "ANDROID", "WEB"], default="WEB")
    deviceName = serializers.CharField(max_length=100, default="Web Client")
    clientVersion = serializers.CharField(max_length=20, default="1.0.0")


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=10, write_only=True)
    baseCurrency = serializers.CharField(max_length=3, default="USD")
    device = DeviceMetadataSerializer(required=False, default=dict)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    device = DeviceMetadataSerializer(required=False, default=dict)


class RefreshSerializer(serializers.Serializer):
    refreshToken = serializers.CharField()
    deviceId = serializers.UUIDField()


class LogoutSerializer(serializers.Serializer):
    refreshToken = serializers.CharField()
    deviceId = serializers.UUIDField()


class PhoneAuthSerializer(serializers.Serializer):
    idToken = serializers.CharField(required=True)
    baseCurrency = serializers.CharField(max_length=3, default="USD")
    device = DeviceMetadataSerializer(required=False, default=dict)


class UserSerializer(serializers.ModelSerializer):
    phoneNumber = serializers.CharField(source="phone_number", read_only=True)
    baseCurrency = serializers.CharField(source="base_currency")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "phoneNumber", "baseCurrency", "createdAt"]
        read_only_fields = ["id", "email", "phoneNumber", "createdAt"]


class TokenResponseSerializer(serializers.Serializer):
    accessToken = serializers.CharField()
    refreshToken = serializers.CharField()
    expiresIn = serializers.IntegerField()


class AuthResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    tokens = TokenResponseSerializer()


class SendPhoneOTPSerializer(serializers.Serializer):
    phoneNumber = serializers.CharField(required=True, max_length=20)


class SendPhoneOTPResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    phoneNumber = serializers.CharField()
    cooldown = serializers.IntegerField()
    expiresIn = serializers.IntegerField()
    simulated = serializers.BooleanField(required=False)


class VerifyPhoneOTPSerializer(serializers.Serializer):
    phoneNumber = serializers.CharField(required=True, max_length=20)
    otp = serializers.CharField(required=True, min_length=6, max_length=6)
    baseCurrency = serializers.CharField(max_length=3, required=False, default="INR")
    device = DeviceMetadataSerializer(required=False, default=dict)


