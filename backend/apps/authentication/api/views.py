from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.api.serializers import (
    AuthResponseSerializer,
    LoginSerializer,
    LogoutSerializer,
    RefreshSerializer,
    RegisterSerializer,
    TokenResponseSerializer,
    UserSerializer,
)
from apps.authentication.services.auth_service import (
    login_user,
    logout_device,
    refresh_tokens,
    register_user,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=RegisterSerializer, responses={201: AuthResponseSerializer})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, access_token, refresh_token, expires_in = register_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            base_currency=serializer.validated_data.get("baseCurrency", "USD"),
            device_data=serializer.validated_data.get("device", {}),
        )

        response_data = {
            "user": UserSerializer(user).data,
            "tokens": {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresIn": expires_in,
            },
        }
        return Response(response_data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=LoginSerializer, responses={200: AuthResponseSerializer})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, access_token, refresh_token, expires_in = login_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            device_data=serializer.validated_data.get("device", {}),
        )

        response_data = {
            "user": UserSerializer(user).data,
            "tokens": {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresIn": expires_in,
            },
        }
        return Response(response_data, status=status.HTTP_200_OK)


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=RefreshSerializer, responses={200: TokenResponseSerializer})
    def post(self, request):
        serializer = RefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        access_token, new_refresh_token, expires_in = refresh_tokens(
            raw_refresh=serializer.validated_data["refreshToken"],
            device_id=str(serializer.validated_data["deviceId"]),
        )

        return Response(
            {
                "accessToken": access_token,
                "refreshToken": new_refresh_token,
                "expiresIn": expires_in,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=LogoutSerializer, responses={204: None})
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        logout_device(
            raw_refresh=serializer.validated_data["refreshToken"],
            device_id=str(serializer.validated_data["deviceId"]),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserSerializer})
    def get(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

    @extend_schema(request=UserSerializer, responses={200: UserSerializer})
    def patch(self, request):
        base_currency = request.data.get("baseCurrency")
        if base_currency:
            request.user.base_currency = base_currency
            request.user.save(update_fields=["base_currency", "updated_at"])
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)
