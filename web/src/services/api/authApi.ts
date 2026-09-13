import { apiClient } from './client';
import {
  AuthResponse,
  LoginCredentials,
  PhoneAuthPayload,
  RegisterCredentials,
  SendPhoneOtpResponse,
  TokenResponse,
  User,
} from '@/types/auth';
import { getClientDeviceMetadata } from '@/utils/device';

export const authApi = {
  /**
   * Register a new user and initial device.
   * POST /api/v1/auth/register/
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const payload = {
      email: credentials.email.toLowerCase().trim(),
      password: credentials.password,
      baseCurrency: credentials.baseCurrency || 'USD',
      device: credentials.device || getClientDeviceMetadata(),
    };
    const response = await apiClient.post<AuthResponse>('/auth/register/', payload);
    return response.data;
  },

  /**
   * Authenticate with email & password, returning token pair and user profile.
   * POST /api/v1/auth/login/
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const payload = {
      email: credentials.email.toLowerCase().trim(),
      password: credentials.password,
      device: credentials.device || getClientDeviceMetadata(),
    };
    const response = await apiClient.post<AuthResponse>('/auth/login/', payload);
    return response.data;
  },

  /**
   * Dispatches a 6-digit OTP code to mobile number via Fast2SMS Indian SMS Gateway.
   * POST /api/v1/auth/phone/send-otp/
   */
  async sendPhoneOtp(phoneNumber: string): Promise<SendPhoneOtpResponse> {
    const response = await apiClient.post<SendPhoneOtpResponse>('/auth/phone/send-otp/', {
      phoneNumber,
    });
    return response.data;
  },

  /**
   * Verifies 6-digit OTP code and registers/logs in the phone user.
   * POST /api/v1/auth/phone/verify-otp/
   */
  async verifyPhoneOtp(
    phoneNumber: string,
    otp: string,
    baseCurrency = 'INR'
  ): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/phone/verify-otp/', {
      phoneNumber,
      otp,
      baseCurrency,
      device: getClientDeviceMetadata(),
    });
    return response.data;
  },

  /**
   * Authenticate or register with Firebase Phone ID Token.
   * POST /api/v1/auth/phone/
   */
  async loginWithPhone(payload: PhoneAuthPayload): Promise<AuthResponse> {
    const requestPayload = {
      idToken: payload.idToken,
      baseCurrency: payload.baseCurrency || 'USD',
      device: payload.device || getClientDeviceMetadata(),
    };
    const response = await apiClient.post<AuthResponse>('/auth/phone/', requestPayload);
    return response.data;
  },



  /**
   * Rotate access and refresh tokens.
   * POST /api/v1/auth/refresh/
   */
  async refresh(refreshToken: string, deviceId: string): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/auth/refresh/', {
      refreshToken,
      deviceId,
    });
    return response.data;
  },

  /**
   * Revoke active session on server and invalidate refresh token.
   * POST /api/v1/auth/logout/
   */
  async logout(refreshToken: string, deviceId: string): Promise<void> {
    await apiClient.post('/auth/logout/', {
      refreshToken,
      deviceId,
    });
  },

  /**
   * Fetch current authenticated user profile.
   * GET /api/v1/auth/me/
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me/');
    return response.data;
  },

  /**
   * Update current authenticated user profile (e.g. base currency).
   * PATCH /api/v1/auth/me/
   */
  async updateCurrentUser(payload: { baseCurrency?: string }): Promise<User> {
    const response = await apiClient.patch<User>('/auth/me/', payload);
    return response.data;
  },
};

