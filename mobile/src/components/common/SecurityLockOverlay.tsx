import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Image,
  Animated,
  Vibration,
} from 'react-native';
import { securityLockService } from '../../services/securityLockService';
import { APP_LOGO } from '../../assets/appLogo';
import { useTheme } from '../../theme/useTheme';
import { useAuth } from '../../app/providers/AuthProvider';

export const SecurityLockOverlay: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutSec, setLockoutSec] = useState<number>(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Check lock requirement
  const checkLockState = useCallback(async () => {
    if (isLoading || !isAuthenticated) {
      setIsLocked(false);
      return;
    }
    const shouldLock = await securityLockService.shouldShowLock();
    if (shouldLock) {
      setIsLocked(true);
      setEnteredPin('');
      setErrorMessage(null);
    } else {
      setIsLocked(false);
    }
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    checkLockState();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        securityLockService.onAppBackground();
      } else if (nextAppState === 'active') {
        checkLockState();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkLockState]);

  // Lockout countdown timer
  useEffect(() => {
    let interval: any;
    if (lockoutSec > 0) {
      interval = setInterval(() => {
        setLockoutSec((prev) => {
          if (prev <= 1) {
            setErrorMessage(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutSec]);

  const triggerShake = () => {
    try {
      Vibration.vibrate(100);
    } catch {}
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = async (digit: string) => {
    if (lockoutSec > 0) return;
    if (enteredPin.length >= 4) return;

    const newPin = enteredPin + digit;
    setEnteredPin(newPin);
    setErrorMessage(null);

    if (newPin.length === 4) {
      // Validate PIN
      const res = await securityLockService.verifyPin(newPin);
      if (res.success) {
        setIsLocked(false);
        setEnteredPin('');
        setErrorMessage(null);
      } else {
        triggerShake();
        if (res.isLockedOut && res.lockoutRemainingSeconds) {
          setLockoutSec(res.lockoutRemainingSeconds);
          setErrorMessage(`Too many attempts. Locked for ${res.lockoutRemainingSeconds}s`);
        } else {
          setErrorMessage('Incorrect PIN. Please try again.');
        }
        setTimeout(() => {
          setEnteredPin('');
        }, 350);
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutSec > 0) return;
    if (enteredPin.length > 0) {
      setEnteredPin(enteredPin.slice(0, -1));
      setErrorMessage(null);
    }
  };

  if (!isLocked || isLoading || !isAuthenticated) {
    return null;
  }

  const isError = !!errorMessage;
  const bgColor = isDark ? '#0B1120' : '#F8FAFC';
  const textColor = isDark ? '#F1F5F9' : '#0F172A';
  const subtitleColor = isDark ? '#94A3B8' : '#64748B';
  const keyBg = isDark ? '#1E293B' : '#FFFFFF';
  const keyBorder = isDark ? '#334155' : '#E2E8F0';

  return (
    <View style={[styles.overlay, { backgroundColor: bgColor }]}>
      {/* Header Info */}
      <View style={styles.header}>
        <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.appName, { color: textColor }]}>Spending Book</Text>
        <Text style={[styles.subtitle, { color: subtitleColor }]}>
          {lockoutSec > 0
            ? `Device locked. Try again in ${lockoutSec}s`
            : 'Enter your 4-digit PIN to access'}
        </Text>
      </View>

      {/* PIN Dots Indicator */}
      <Animated.View
        style={[
          styles.dotsContainer,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        {[0, 1, 2, 3].map((index) => {
          const isFilled = enteredPin.length > index;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  borderColor: isError ? '#EF4444' : isFilled ? '#2563EB' : keyBorder,
                  backgroundColor: isError
                    ? '#EF4444'
                    : isFilled
                    ? '#2563EB'
                    : 'transparent',
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Error / Lockout Text */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : (
        <View style={styles.errorPlaceholder} />
      )}

      {/* Numeric Keypad (3x4 Grid) */}
      <View style={styles.keypadContainer}>
        <View style={styles.keyRow}>
          {['1', '2', '3'].map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.keyButton, { backgroundColor: keyBg, borderColor: keyBorder }]}
              onPress={() => handleKeyPress(d)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: textColor }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.keyRow}>
          {['4', '5', '6'].map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.keyButton, { backgroundColor: keyBg, borderColor: keyBorder }]}
              onPress={() => handleKeyPress(d)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: textColor }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.keyRow}>
          {['7', '8', '9'].map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.keyButton, { backgroundColor: keyBg, borderColor: keyBorder }]}
              onPress={() => handleKeyPress(d)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: textColor }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.keyRow}>
          <View style={styles.keyPlaceholder} />
          <TouchableOpacity
            style={[styles.keyButton, { backgroundColor: keyBg, borderColor: keyBorder }]}
            onPress={() => handleKeyPress('0')}
            activeOpacity={0.6}
          >
            <Text style={[styles.keyText, { color: textColor }]}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.keyButton, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
            onPress={handleBackspace}
            activeOpacity={0.6}
          >
            <Text style={[styles.backspaceText, { color: textColor }]}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 16,
    marginBottom: 14,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 16,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    height: 20,
  },
  errorPlaceholder: {
    height: 20,
  },
  keypadContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 20,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
  },
  backspaceText: {
    fontSize: 24,
    fontWeight: '600',
  },
  keyPlaceholder: {
    width: 72,
    height: 72,
  },
});
