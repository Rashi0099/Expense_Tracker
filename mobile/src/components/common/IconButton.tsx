import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { APP_CONSTANTS } from '../../app/config/constants';

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: 'ghost' | 'filled' | 'outline';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
  variant = 'ghost',
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[
        styles.button,
        {
          backgroundColor:
            variant === 'filled'
              ? theme.colors.surfaceSubtle
              : 'transparent',
          borderColor:
            variant === 'outline'
              ? theme.colors.surfaceBorder
              : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          borderRadius: theme.borderRadius.pill,
        },
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minWidth: APP_CONSTANTS.MIN_TOUCH_TARGET_SIZE,
    minHeight: APP_CONSTANTS.MIN_TOUCH_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
});
