import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { APP_CONSTANTS } from '../../app/config/constants';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { theme } = useTheme();

  const isDisabled = disabled || isLoading;

  // Background color mapping
  const getBackgroundColor = () => {
    if (isDisabled && variant !== 'ghost' && variant !== 'outline') {
      return theme.colors.surfaceSubtle;
    }
    switch (variant) {
      case 'primary':
        return theme.colors.primary;
      case 'secondary':
        return theme.colors.surfaceSubtle;
      case 'danger':
        return theme.colors.expense;
      case 'outline':
      case 'ghost':
        return 'transparent';
      default:
        return theme.colors.primary;
    }
  };

  // Text color mapping
  const getTextColor = () => {
    if (isDisabled) {
      return theme.colors.textMuted;
    }
    switch (variant) {
      case 'primary':
      case 'danger':
        return theme.colors.textInverse;
      case 'secondary':
        return theme.colors.textPrimary;
      case 'outline':
        return theme.colors.primary;
      case 'ghost':
        return theme.colors.primary;
      default:
        return theme.colors.textInverse;
    }
  };

  // Height & padding mapping
  const getHeight = () => {
    switch (size) {
      case 'sm':
        return Math.max(APP_CONSTANTS.MIN_TOUCH_TARGET_SIZE, 40);
      case 'lg':
        return 56;
      case 'md':
      default:
        return 48;
    }
  };

  const getPaddingHorizontal = () => {
    switch (size) {
      case 'sm':
        return theme.spacing.md;
      case 'lg':
        return theme.spacing.xxl;
      case 'md':
      default:
        return theme.spacing.lg;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          minHeight: getHeight(),
          paddingHorizontal: getPaddingHorizontal(),
          borderRadius: theme.borderRadius.lg,
          borderColor:
            variant === 'outline'
              ? isDisabled
                ? theme.colors.surfaceBorder
                : theme.colors.primary
              : 'transparent',
          borderWidth: variant === 'outline' ? 1.5 : 0,
        },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : theme.colors.primary}
        />
      ) : (
        <>
          {leftIcon ? <React.Fragment>{leftIcon}</React.Fragment> : null}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: size === 'sm' ? 13 : size === 'lg' ? 16 : 14,
                marginHorizontal: leftIcon || rightIcon ? theme.spacing.sm : 0,
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {rightIcon ? <React.Fragment>{rightIcon}</React.Fragment> : null}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
