import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { securityLockService } from '../../services/securityLockService';
import { Button } from './Button';

export type PinModalMode = 'SETUP' | 'CHANGE' | 'DISABLE';

interface PinSetupModalProps {
  visible: boolean;
  mode: PinModalMode;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  visible,
  mode,
  onClose,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();

  // Multi-step state:
  // SETUP: 1 = Enter new, 2 = Confirm new
  // CHANGE: 1 = Enter old, 2 = Enter new, 3 = Confirm new
  // DISABLE: 1 = Enter current
  const [step, setStep] = useState<number>(1);
  const [oldPin, setOldPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [currentEntry, setCurrentEntry] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setCurrentEntry('');
      setErrorText(null);
    }
  }, [visible, mode]);

  const getTitleAndSubtitle = () => {
    if (mode === 'SETUP') {
      if (step === 1) {
        return {
          title: 'Set App PIN',
          subtitle: 'Choose a 4-digit PIN to secure your financial data.',
        };
      }
      return {
        title: 'Confirm PIN',
        subtitle: 'Re-enter your 4-digit PIN to confirm.',
      };
    }

    if (mode === 'CHANGE') {
      if (step === 1) {
        return {
          title: 'Enter Current PIN',
          subtitle: 'Please verify your existing PIN first.',
        };
      }
      if (step === 2) {
        return {
          title: 'Enter New PIN',
          subtitle: 'Choose a new 4-digit PIN.',
        };
      }
      return {
        title: 'Confirm New PIN',
        subtitle: 'Re-enter your new PIN to confirm.',
      };
    }

    // DISABLE
    return {
      title: 'Disable App Lock',
      subtitle: 'Enter your current 4-digit PIN to turn off security lock.',
    };
  };

  const handleKeyPress = async (digit: string) => {
    if (currentEntry.length >= 4) return;
    const updated = currentEntry + digit;
    setCurrentEntry(updated);
    setErrorText(null);

    if (updated.length === 4) {
      // Process step completion
      if (mode === 'SETUP') {
        if (step === 1) {
          setNewPin(updated);
          setCurrentEntry('');
          setStep(2);
        } else {
          // Confirm step
          if (updated === newPin) {
            const ok = await securityLockService.enableLock(updated);
            if (ok) {
              Alert.alert('Security PIN Enabled', 'Your app is now protected with a 4-digit PIN.');
              onSuccess();
            } else {
              setErrorText('Failed to save PIN. Please try again.');
              setCurrentEntry('');
            }
          } else {
            setErrorText('PINs do not match. Please try again.');
            setCurrentEntry('');
            setStep(1);
          }
        }
      } else if (mode === 'CHANGE') {
        if (step === 1) {
          const verify = await securityLockService.verifyPin(updated);
          if (verify.success) {
            setOldPin(updated);
            setCurrentEntry('');
            setStep(2);
          } else {
            setErrorText('Incorrect current PIN. Please try again.');
            setCurrentEntry('');
          }
        } else if (step === 2) {
          setNewPin(updated);
          setCurrentEntry('');
          setStep(3);
        } else {
          if (updated === newPin) {
            const ok = await securityLockService.changePin(oldPin, updated);
            if (ok) {
              Alert.alert('PIN Updated', 'Your security PIN has been changed successfully.');
              onSuccess();
            } else {
              setErrorText('Failed to update PIN.');
              setCurrentEntry('');
            }
          } else {
            setErrorText('New PINs do not match. Try again.');
            setCurrentEntry('');
            setStep(2);
          }
        }
      } else if (mode === 'DISABLE') {
        const ok = await securityLockService.disableLock(updated);
        if (ok) {
          Alert.alert('App Lock Disabled', 'Security PIN has been turned off.');
          onSuccess();
        } else {
          setErrorText('Incorrect PIN. Security lock remains active.');
          setCurrentEntry('');
        }
      }
    }
  };

  const handleBackspace = () => {
    if (currentEntry.length > 0) {
      setCurrentEntry(currentEntry.slice(0, -1));
      setErrorText(null);
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();
  const cardBg = isDark ? '#161B2E' : '#FFFFFF';
  const keyBg = isDark ? '#1E293B' : '#F1F5F9';
  const keyBorder = isDark ? '#2E3856' : '#E2E8F0';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {/* Header */}
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>

          {/* PIN Dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => {
              const isFilled = currentEntry.length > i;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      borderColor: errorText ? '#EF4444' : isFilled ? theme.colors.primary : keyBorder,
                      backgroundColor: errorText
                        ? '#EF4444'
                        : isFilled
                        ? theme.colors.primary
                        : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Error Message */}
          {errorText ? (
            <Text style={styles.errorText}>{errorText}</Text>
          ) : (
            <View style={{ height: 18 }} />
          )}

          {/* Keypad */}
          <View style={styles.keypad}>
            <View style={styles.keyRow}>
              {['1', '2', '3'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.key, { backgroundColor: keyBg, borderColor: keyBorder }]}
                  onPress={() => handleKeyPress(d)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.keyText, { color: theme.colors.textPrimary }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.keyRow}>
              {['4', '5', '6'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.key, { backgroundColor: keyBg, borderColor: keyBorder }]}
                  onPress={() => handleKeyPress(d)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.keyText, { color: theme.colors.textPrimary }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.keyRow}>
              {['7', '8', '9'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.key, { backgroundColor: keyBg, borderColor: keyBorder }]}
                  onPress={() => handleKeyPress(d)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.keyText, { color: theme.colors.textPrimary }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.keyRow}>
              <View style={styles.keyPlaceholder} />
              <TouchableOpacity
                style={[styles.key, { backgroundColor: keyBg, borderColor: keyBorder }]}
                onPress={() => handleKeyPress('0')}
                activeOpacity={0.6}
              >
                <Text style={[styles.keyText, { color: theme.colors.textPrimary }]}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.key, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
                onPress={handleBackspace}
                activeOpacity={0.6}
              >
                <Text style={[styles.keyText, { color: theme.colors.textMuted }]}>⌫</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cancel button */}
          <Button
            label="Cancel"
            variant="outline"
            size="sm"
            onPress={onClose}
            style={{ marginTop: 16, width: '100%' }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    height: 18,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    marginTop: 10,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  key: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
  },
  keyPlaceholder: {
    width: 62,
    height: 62,
  },
});
