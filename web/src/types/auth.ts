export interface User {
  id: string;
  email: string;
  baseCurrency: string;
  createdAt: string;
}

export interface DeviceMetadata {
  id?: string;
  platform: 'WEB' | 'IOS' | 'ANDROID';
  deviceName: string;
  clientVersion: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  device?: DeviceMetadata;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  baseCurrency?: string;
  device?: DeviceMetadata;
}

export type AuthStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'REFRESHING';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
}

export interface AuthContextType {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  updateUser: (payload: { baseCurrency?: string }) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isInitializing: boolean;
}

