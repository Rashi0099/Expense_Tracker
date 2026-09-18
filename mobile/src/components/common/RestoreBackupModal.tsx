import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Button } from './Button';
import { backupService, BackupPayload } from '../../services/backupService';

interface RestoreBackupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RestoreBackupModal: React.FC<RestoreBackupModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const [jsonInput, setJsonInput] = useState('');
  const [parsedPayload, setParsedPayload] = useState<BackupPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleValidate = (text: string) => {
    setJsonInput(text);
    setErrorMsg(null);
    setParsedPayload(null);

    if (!text.trim()) return;

    const validation = backupService.validateBackup(text.trim());
    if (validation.valid && validation.payload) {
      setParsedPayload(validation.payload);
    } else {
      setErrorMsg(validation.error || 'Invalid backup format');
    }
  };

  const handleExecuteRestore = async () => {
    if (!parsedPayload && !jsonInput.trim()) return;

    Alert.alert(
      'Confirm Data Restore',
      'Restoring this backup will replace current offline transactions, wallets, and categories. This action cannot be undone. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Now',
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true);
            try {
              const res = await backupService.restoreBackup(parsedPayload || jsonInput.trim());
              if (res.success && res.counts) {
                Alert.alert(
                  'Restore Complete',
                  `Successfully restored:\n• ${res.counts.expenses} Expenses\n• ${res.counts.income} Income records\n• ${res.counts.wallets} Wallets\n• ${res.counts.categories} Categories`
                );
                onSuccess();
              } else {
                Alert.alert('Restore Failed', res.error || 'Unable to restore backup.');
              }
            } catch (err: any) {
              Alert.alert('Restore Error', err.message || 'An unexpected error occurred.');
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  };

  const cardBg = isDark ? '#161B2E' : '#FFFFFF';
  const inputBg = isDark ? '#0F172A' : '#F8FAFC';
  const borderCol = isDark ? '#2E3856' : '#E2E8F0';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Restore from Backup
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Paste your backup JSON below to preview and restore your data.
          </Text>

          <TextInput
            multiline
            numberOfLines={6}
            placeholder="Paste Spending Book backup JSON here..."
            placeholderTextColor={theme.colors.textMuted}
            value={jsonInput}
            onChangeText={handleValidate}
            style={[
              styles.textArea,
              {
                backgroundColor: inputBg,
                borderColor: borderCol,
                color: theme.colors.textPrimary,
              },
            ]}
          />

          {errorMsg && (
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          )}

          {parsedPayload && (
            <View style={[styles.previewCard, { backgroundColor: inputBg, borderColor: borderCol }]}>
              <Text style={[styles.previewTitle, { color: theme.colors.primary }]}>
                ✓ Valid Backup Verified
              </Text>
              <Text style={[styles.previewMeta, { color: theme.colors.textSecondary }]}>
                Created: {new Date(parsedPayload.createdAt).toLocaleDateString()}
              </Text>
              <View style={styles.countsGrid}>
                <Text style={[styles.countItem, { color: theme.colors.textPrimary }]}>
                  👛 Wallets: <Text style={styles.countBold}>{parsedPayload.counts.wallets}</Text>
                </Text>
                <Text style={[styles.countItem, { color: theme.colors.textPrimary }]}>
                  🏷️ Categories: <Text style={styles.countBold}>{parsedPayload.counts.categories}</Text>
                </Text>
                <Text style={[styles.countItem, { color: theme.colors.textPrimary }]}>
                  💸 Expenses: <Text style={styles.countBold}>{parsedPayload.counts.expenses}</Text>
                </Text>
                <Text style={[styles.countItem, { color: theme.colors.textPrimary }]}>
                  💰 Income: <Text style={styles.countBold}>{parsedPayload.counts.income}</Text>
                </Text>
              </View>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              label="Cancel"
              variant="outline"
              size="md"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              label={isRestoring ? 'Restoring...' : 'Restore Now'}
              variant="primary"
              size="md"
              isLoading={isRestoring}
              disabled={!parsedPayload || isRestoring}
              onPress={handleExecuteRestore}
              style={{ flex: 1 }}
            />
          </View>
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
    maxWidth: 420,
    borderRadius: 24,
    padding: 22,
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
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  textArea: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  previewCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewMeta: {
    fontSize: 11,
    marginBottom: 8,
  },
  countsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countItem: {
    fontSize: 12,
    width: '48%',
  },
  countBold: {
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});
