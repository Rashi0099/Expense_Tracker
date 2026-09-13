import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../app/navigation/types';
import { Screen } from '../../components/common/Screen';
import { TextInput } from '../../components/forms/TextInput';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';
import { mobileAuthApi } from '../../api/services/mobileAuthApi';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = () => {
  const { loginWithPhoneOtp } = useAuth();
  const { theme } = useTheme();

  // Phone & OTP states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'PHONE_INPUT' | 'OTP_INPUT'>('PHONE_INPUT');
  const [countdown, setCountdown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendPhoneOtp = async () => {
    const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
    if (!cleanPhone) {
      setError('Please enter your mobile phone number.');
      return;
    }
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;
      setPhoneNumber(fullPhone);
      const res = await mobileAuthApi.sendPhoneOtp(fullPhone);
      setOtpStep('OTP_INPUT');
      setCountdown(res.cooldown || 30);
    } catch (err: any) {
      setError(err?.response?.data?.phoneNumber?.[0] || err?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (!code || code.length < 6) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      await loginWithPhoneOtp(cleanPhone, code, 'INR');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Invalid or expired OTP.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleOtpTextChange = (text: string) => {
    const val = text.replace(/\D/g, '').slice(0, 6);
    setOtpCode(val);
    if (val.length === 6) {
      handleVerifyPhoneOtp(val);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text
          style={[
            styles.badge,
            { color: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
          ]}
        >
          📱 Fast Mobile Sign-In
        </Text>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {otpStep === 'PHONE_INPUT' ? 'Welcome to ExpenseFlow' : 'Verify Your Number'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {otpStep === 'PHONE_INPUT'
            ? 'Enter your mobile number to sign in or register instantly'
            : `6-digit OTP code sent to ${phoneNumber}`}
        </Text>
      </View>

      {error && (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: theme.colors.expenseBg,
              borderColor: theme.colors.expenseBorder,
            },
          ]}
        >
          <Text style={[styles.errorText, { color: theme.colors.expense }]}>{error}</Text>
        </View>
      )}

      {otpStep === 'PHONE_INPUT' ? (
        /* Step 1: Phone Number Input */
        <View style={styles.form}>
          <TextInput
            label="Mobile Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoFocus
            placeholder="e.g. 98765 43210"
          />

          <Button
            label="Send OTP Code"
            onPress={handleSendPhoneOtp}
            isLoading={isLoading}
            style={styles.button}
          />

          <View style={styles.infoBox}>
            <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>
              ✓ No password or email needed{'\n'}
              ✓ Automatic instant account creation
            </Text>
          </View>
        </View>
      ) : (
        /* Step 2: OTP Verification */
        <View style={styles.form}>
          <View style={styles.phoneBadgeContainer}>
            <Text style={[styles.phoneBadgeText, { color: theme.colors.textPrimary }]}>
              {phoneNumber}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setOtpStep('PHONE_INPUT');
                setOtpCode('');
                setError(null);
              }}
            >
              <Text style={[styles.editText, { color: theme.colors.primary }]}>Edit Number</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            label="Enter 6-Digit OTP Code"
            value={otpCode}
            onChangeText={handleOtpTextChange}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            placeholder="••••••"
          />

          <Button
            label="Verify & Sign In"
            onPress={() => handleVerifyPhoneOtp()}
            isLoading={isLoading}
            disabled={otpCode.length < 6}
            style={styles.button}
          />

          <View style={styles.otpFooter}>
            <TouchableOpacity
              onPress={() => {
                setOtpStep('PHONE_INPUT');
                setError(null);
              }}
            >
              <Text style={[styles.backText, { color: theme.colors.textMuted }]}>← Back</Text>
            </TouchableOpacity>

            {countdown > 0 ? (
              <Text style={[styles.countdownText, { color: theme.colors.textMuted }]}>
                Resend in {countdown}s
              </Text>
            ) : (
              <TouchableOpacity onPress={handleSendPhoneOtp}>
                <Text style={[styles.resendText, { color: theme.colors.primary }]}>
                  Resend OTP
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: 12,
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
  phoneBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
  },
  phoneBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  editText: {
    fontSize: 13,
    fontWeight: '600',
  },
  otpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 13,
    fontWeight: '500',
  },
  countdownText: {
    fontSize: 13,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
