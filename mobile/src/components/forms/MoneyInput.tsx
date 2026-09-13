import React, { forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface MoneyInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  currency?: string;
  autoFocus?: boolean;
  style?: ViewStyle;
  error?: string;
}

export const MoneyInput = forwardRef<TextInput, MoneyInputProps>(({
  value,
  onChangeValue,
  currency = 'USD',
  autoFocus = true,
  style,
  error,
}, ref) => {
  const { theme } = useTheme();

  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '¥',
  };
  const currencySymbol = symbols[currency.toUpperCase()] || '$';

  const handleChangeText = (text: string) => {
    // Sanitize: allow numbers and at most one decimal point with 2 decimal places
    let clean = text.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    if (parts[1] && parts[1].length > 2) {
      clean = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    onChangeValue(clean);
  };

  const handleClear = () => {
    onChangeValue('');
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error
              ? theme.colors.expense
              : theme.colors.surfaceBorder,
            borderRadius: theme.borderRadius.xl,
          },
        ]}
      >
        <Text
          style={[
            styles.currencySymbol,
            { color: theme.colors.primary },
          ]}
        >
          {currencySymbol}
        </Text>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={handleChangeText}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              color: theme.colors.textPrimary,
            },
          ]}
          maxLength={10}
          accessibilityLabel={`Amount in ${currency}`}
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            accessibilityLabel="Clear amount"
            accessibilityRole="button"
          >
            <Text style={[styles.clearText, { color: theme.colors.textMuted }]}>
              ✕
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: theme.colors.expense }]}>
          {error}
        </Text>
      )}
    </View>
  );
});

MoneyInput.displayName = 'MoneyInput';

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 36,
    fontWeight: '800',
    padding: 0,
  },
  clearButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  clearText: {
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 4,
  },
});
