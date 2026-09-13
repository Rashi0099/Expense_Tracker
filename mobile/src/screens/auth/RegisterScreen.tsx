import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../app/navigation/types';
import { Screen } from '../../components/common/Screen';
import { TextInput } from '../../components/forms/TextInput';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { register } = useAuth();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await register(email.trim().toLowerCase(), password, baseCurrency);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Create an Account
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Get started with offline-first expense tracking
        </Text>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: theme.colors.expenseBg, borderColor: theme.colors.expenseBorder }]}>
          <Text style={[styles.errorText, { color: theme.colors.expense }]}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        <TextInput
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
        />

        <TextInput
          label="Password (min 10 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••••"
        />

        <TextInput
          label="Base Currency (ISO 3-letter)"
          value={baseCurrency}
          onChangeText={(v) => setBaseCurrency(v.toUpperCase().slice(0, 3))}
          autoCapitalize="characters"
          maxLength={3}
          placeholder="USD"
        />

        <Button
          label="Create Account"
          onPress={handleRegister}
          isLoading={isLoading}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.switchButton}
          accessibilityRole="button"
        >
          <Text style={[styles.switchText, { color: theme.colors.textSecondary }]}>
            Already have an account?{' '}
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 28,
    marginTop: 20,
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
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
    padding: 8,
  },
  switchText: {
    fontSize: 13,
  },
});
