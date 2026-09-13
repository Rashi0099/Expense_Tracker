import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAxZDVJFacbOvJVkgZ_KUMu1U5u66FC5oQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'expense-tracker-d0a86.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'expense-tracker-d0a86',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'expense-tracker-d0a86.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '22317762023',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:22317762023:web:baa37678ba058bea0ba942',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(app);

// Keep track of active recaptcha verifier
let recaptchaVerifier: RecaptchaVerifier | null = null;

export const initRecaptcha = (containerId: string): RecaptchaVerifier => {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Ignore cleanup error
    }
  }

  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - will allow signInWithPhoneNumber
    },
    'expired-callback': () => {
      // Response expired. Ask user to solve reCAPTCHA again.
    },
  });

  return recaptchaVerifier;
};

export interface PhoneOtpSession {
  confirmationResult?: ConfirmationResult;
  isMock?: boolean;
  phoneNumber: string;
}

/**
 * Send 6-digit SMS OTP to provided phone number.
 * Supports standard E.164 phone numbers (e.g. +919876543210).
 */
export const sendPhoneOtp = async (
  phoneNumber: string,
  containerId: string = 'recaptcha-container'
): Promise<PhoneOtpSession> => {
  const normalizedPhone = phoneNumber.trim().replace(/\s+/g, '');

  // Allows instant zero-cost testing with +91 9999999999 / 123456
  if (normalizedPhone === '+919999999999') {
    return {
      isMock: true,
      phoneNumber: normalizedPhone,
    };
  }

  const verifier = initRecaptcha(containerId);
  const confirmationResult = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, verifier);

  return {
    confirmationResult,
    isMock: false,
    phoneNumber: normalizedPhone,
  };
};

/**
 * Verify received 6-digit OTP code and return Firebase ID Token.
 */
export const verifyPhoneOtp = async (
  session: PhoneOtpSession,
  otpCode: string
): Promise<string> => {
  const cleanOtp = otpCode.trim();

  if (session.isMock) {
    if (cleanOtp !== '123456') {
      throw new Error('Invalid verification code. (For test numbers, use 123456)');
    }
    return `mock-phone-token-${session.phoneNumber}`;
  }

  if (!session.confirmationResult) {
    throw new Error('No active verification session found. Please request a new OTP.');
  }

  const userCredential = await session.confirmationResult.confirm(cleanOtp);
  const idToken = await userCredential.user.getIdToken();
  return idToken;
};
