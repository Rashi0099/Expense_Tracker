import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useSync } from '../../sync/hooks/useSync';
import { useNetworkState } from '../../sync/network/useNetworkState';
import { useTheme } from '../../theme/useTheme';

export const SyncStatusPill: React.FC = () => {
  const { isSyncing, syncNow, pendingCount, lastError } = useSync();
  const { isOffline } = useNetworkState();
  const { theme } = useTheme();

  const getStatus = () => {
    if (lastError) {
      return {
        label: 'Sync issue',
        icon: '⚠️',
        color: theme.colors.warning,
        bgColor: `${theme.colors.warning}15`,
      };
    }
    if (isSyncing) {
      return {
        label: 'Syncing',
        icon: '↻',
        color: theme.colors.primary,
        bgColor: `${theme.colors.primary}15`,
      };
    }
    if (isOffline) {
      return {
        label: 'Offline',
        icon: '○',
        color: theme.colors.textMuted,
        bgColor: theme.colors.surfaceSubtle,
      };
    }
    if (pendingCount > 0) {
      return {
        label: `${pendingCount} queued`,
        icon: '⬆️',
        color: theme.colors.primary,
        bgColor: `${theme.colors.primary}15`,
      };
    }
    return {
      label: 'Synced',
      icon: '✓',
      color: theme.colors.income,
      bgColor: `${theme.colors.income}15`,
    };
  };

  const status = getStatus();

  return (
    <TouchableOpacity
      onPress={syncNow}
      disabled={isSyncing}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: status.bgColor,
          borderColor: theme.colors.surfaceBorder,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${status.label}. Tap to sync.`}
    >
      <Text style={[styles.icon, { color: status.color }]}>{status.icon}</Text>
      <Text style={[styles.label, { color: status.color }]}>{status.label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 6,
  },
  icon: {
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
