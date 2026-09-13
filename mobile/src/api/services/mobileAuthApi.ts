import { mobileApiClient } from '../client/mobileApiClient';
import { ENV } from '../../app/config/env';

export interface MobileUser {
  id: string;
  email?: string | null;
  phoneNumber?: string | null;
  baseCurrency: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: MobileUser;
  tokens: AuthTokens;
}

export const mobileAuthApi = {
  async register(email: string, password: string, deviceId: string, baseCurrency = 'USD'): Promise<AuthResponse> {
    const res = await mobileApiClient.post<AuthResponse>('/auth/register/', {
      email,
      password,
      baseCurrency,
      device: {
        id: deviceId,
        deviceName: 'Mobile Device',
        platform: ENV.PLATFORM,
        clientVersion: ENV.CLIENT_VERSION,
      },
    });
    return res.data;
  },

  async login(email: string, password: string, deviceId: string): Promise<AuthResponse> {
    const res = await mobileApiClient.post<AuthResponse>('/auth/login/', {
      email,
      password,
      device: {
        id: deviceId,
        deviceName: 'Mobile Device',
        platform: ENV.PLATFORM,
        clientVersion: ENV.CLIENT_VERSION,
      },
    });
    return res.data;
  },

  async sendPhoneOtp(phoneNumber: string): Promise<{ success: boolean; message: string; cooldown: number }> {
    const res = await mobileApiClient.post('/auth/phone/send-otp/', {
      phoneNumber,
    });
    return res.data;
  },

  async verifyPhoneOtp(
    phoneNumber: string,
    otp: string,
    deviceId: string,
    baseCurrency = 'INR'
  ): Promise<AuthResponse> {
    const res = await mobileApiClient.post<AuthResponse>('/auth/phone/verify-otp/', {
      phoneNumber,
      otp,
      baseCurrency,
      device: {
        id: deviceId,
        deviceName: 'Mobile Device',
        platform: ENV.PLATFORM,
        clientVersion: ENV.CLIENT_VERSION,
      },
    });
    return res.data;
  },

  async loginWithPhone(idToken: string, deviceId: string, baseCurrency = 'INR'): Promise<AuthResponse> {
    const res = await mobileApiClient.post<AuthResponse>('/auth/phone/', {
      idToken,
      baseCurrency,
      device: {
        id: deviceId,
        deviceName: 'Mobile Device',
        platform: ENV.PLATFORM,
        clientVersion: ENV.CLIENT_VERSION,
      },
    });
    return res.data;
  },



  async logout(refreshToken: string, deviceId: string): Promise<void> {
    await mobileApiClient.post('/auth/logout/', {
      refreshToken,
      deviceId,
    });
  },

  async getMe(): Promise<MobileUser> {
    const res = await mobileApiClient.get<MobileUser>('/auth/me/');
    return res.data;
  },
};
