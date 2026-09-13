import React, { useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../app/navigation/types';
import { LoginScreen } from './LoginScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/**
 * Mobile authentication is now exclusively Phone Number + OTP.
 * Registration and Login are unified into LoginScreen.
 */
export const RegisterScreen: React.FC<Props> = (props) => {
  return <LoginScreen {...(props as any)} />;
};
