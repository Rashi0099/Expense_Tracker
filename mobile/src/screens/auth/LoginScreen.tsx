import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../app/navigation/types';
import { Screen } from '../../components/common/Screen';
import { TextInput } from '../../components/forms/TextInput';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.badge, { color: theme.colors.primary, backgroundColor: theme.colors.primaryLight }]}>
          Mobile Companion
        </Text>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Sign in to ExpenseFlow
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Fast, offline-first personal financial tracker
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
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••••"
        />

        <Button
          label="Sign In"
          onPress={handleLogin}
          isLoading={isLoading}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          style={styles.switchButton}
          accessibilityRole="button"
        >
          <Text style={[styles.switchText, { color: theme.colors.textSecondary }]}>
            Don't have an account?{' '}
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Create one</Text>
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
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
    padding: 8,
  },
  switchText: {
    fontSize: 13,
  },
});
