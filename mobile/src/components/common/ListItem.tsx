import React, { ReactNode } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { APP_CONSTANTS } from '../../app/config/constants';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  leftElement,
  rightElement,
  onPress,
  style,
}) => {
  const { theme } = useTheme();

  const content = (
    <View style={[styles.container, { minHeight: APP_CONSTANTS.MIN_TOUCH_TARGET_SIZE }, style]}>
      {leftElement && <View style={styles.left}>{leftElement}</View>}
      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: theme.colors.textPrimary }]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.colors.textMuted }]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement && <View style={styles.right}>{rightElement}</View>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  left: {
    marginRight: 12,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
});
