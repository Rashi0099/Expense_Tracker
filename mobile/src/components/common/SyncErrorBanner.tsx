import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSync } from '../../sync/hooks/useSync';
import { useTheme } from '../../theme/useTheme';

export const SyncErrorBanner: React.FC = () => {
  const { lastError, syncNow, isSyncing } = useSync();
  const { theme } = useTheme();

  if (!lastError) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${theme.colors.warning}15`,
          borderColor: theme.colors.warning,
        },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          ⚠️ Some changes couldn't sync
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Your data is safely stored locally. We will retry automatically when connection stabilizes.
        </Text>
      </View>

      <TouchableOpacity
        onPress={syncNow}
        disabled={isSyncing}
        style={[styles.retryButton, { backgroundColor: theme.colors.warning }]}
        accessibilityRole="button"
        accessibilityLabel="Retry syncing changes"
      >
        <Text style={styles.retryText}>{isSyncing ? '...' : 'Retry'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
