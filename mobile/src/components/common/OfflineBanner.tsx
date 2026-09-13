import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface OfflineBannerProps {
  isOffline: boolean;
  pendingCount?: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  pendingCount = 0,
}) => {
  const { theme } = useTheme();

  if (!isOffline && pendingCount === 0) {
    return null;
  }

  const message = isOffline
    ? pendingCount > 0
      ? `Offline — ${pendingCount} change${pendingCount > 1 ? 's' : ''} queued to sync`
      : "Offline — changes will sync when you're back online"
    : `Syncing ${pendingCount} pending change${pendingCount > 1 ? 's' : ''}...`;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isOffline
            ? theme.colors.warningBg
            : theme.colors.infoBg,
          borderColor: isOffline
            ? theme.colors.warningBorder
            : theme.colors.infoBorder,
        },
      ]}
      accessibilityRole="alert"
    >
      <Text style={styles.icon}>{isOffline ? '📡' : '🔄'}</Text>
      <Text
        style={[
          styles.text,
          {
            color: isOffline
              ? theme.colors.warning
              : theme.colors.info,
          },
        ]}
      >
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  icon: {
    fontSize: 12,
    marginRight: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
