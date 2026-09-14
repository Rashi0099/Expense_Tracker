import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { hotUpdateService, UpdateCheckResult } from '../../services/HotUpdateService';

export interface HotUpdateModalProps {
  visible: boolean;
  updateInfo: UpdateCheckResult | null;
  onDismiss: () => void;
}

export const HotUpdateModal: React.FC<HotUpdateModalProps> = ({
  visible,
  updateInfo,
  onDismiss,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const [bytesText, setBytesText] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Always reset state cleanly whenever modal becomes visible
  useEffect(() => {
    if (visible) {
      setIsDownloading(false);
      setPercentage(0);
      setBytesText('');
      setIsCompleted(false);
      setErrorMessage(null);
    }
  }, [visible]);

  if (!visible || !updateInfo || !updateInfo.isAvailable) {
    return null;
  }

  const handleStartUpdate = async () => {
    if (!updateInfo.bundleUrl || !updateInfo.latestVersion) return;

    setIsDownloading(true);
    setIsCompleted(false);
    setPercentage(0);
    setBytesText('');
    setErrorMessage(null);

    try {
      const success = await hotUpdateService.downloadUpdate(
        updateInfo.bundleUrl,
        updateInfo.latestVersion,
        (progress) => {
          setPercentage(progress.percentage);
          const mbDownloaded = (progress.bytesDownloaded / (1024 * 1024)).toFixed(1);
          const mbTotal = (progress.totalBytes / (1024 * 1024)).toFixed(1);
          if (progress.totalBytes > 0) {
            setBytesText(`${mbDownloaded} MB / ${mbTotal} MB`);
          }
        }
      );

      if (success) {
        setIsDownloading(false);
        setIsCompleted(true);
        setPercentage(100);
      } else {
        setErrorMessage('Failed to download update. Please check connection and try again.');
        setIsDownloading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setErrorMessage(msg);
      setIsDownloading(false);
    }
  };

  const handleApplyAndRestart = () => {
    onDismiss();
    hotUpdateService.reloadApp();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={!isDownloading ? onDismiss : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Badge */}
          <View style={styles.header}>
            <View
              style={[
                styles.badge,
                isCompleted && { backgroundColor: '#ECFDF5' },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isCompleted && { color: '#059669' },
                ]}
              >
                {isCompleted ? 'UPDATE READY' : 'UPDATE AVAILABLE'}
              </Text>
            </View>
            <Text style={styles.versionText}>v{updateInfo.latestVersion}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {isCompleted
              ? 'Update Downloaded'
              : isDownloading
              ? 'Downloading Update...'
              : 'Ready to Update'}
          </Text>

          {/* Description / Notes */}
          <Text style={styles.description}>
            {isCompleted
              ? `Version v${updateInfo.latestVersion} is downloaded and verified. Restart the app now to apply the newest features.`
              : updateInfo.releaseNotes || 'A new update is available with performance improvements.'}
          </Text>

          {/* Download / Completed Progress Bar */}
          {(isDownloading || isCompleted) && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: isCompleted ? '#10B981' : colors.light.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressMeta}>
                <Text
                  style={[
                    styles.progressPercent,
                    isCompleted && { color: '#059669' },
                  ]}
                >
                  {isCompleted ? '✓ 100% Downloaded' : `${percentage}%`}
                </Text>
                {bytesText && !isCompleted ? (
                  <Text style={styles.progressBytes}>{bytesText}</Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Error message */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Initial State Actions */}
          {!isDownloading && !isCompleted && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.laterButton}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={handleStartUpdate}
                activeOpacity={0.8}
              >
                <Text style={styles.updateButtonText}>
                  {errorMessage ? 'Try Again' : 'Update Now'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Downloading in Progress State */}
          {isDownloading && (
            <View style={styles.downloadingState}>
              <ActivityIndicator size="small" color={colors.light.primary} />
              <Text style={styles.downloadingText}>Downloading update, please wait...</Text>
            </View>
          )}

          {/* Completed State: Clear "Done / Restart App" Action */}
          {isCompleted && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.laterButton}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={handleApplyAndRestart}
                activeOpacity={0.8}
              >
                <Text style={styles.doneButtonText}>Done — Restart App</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: colors.light.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 20,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.primary,
  },
  progressBytes: {
    fontSize: 12,
    color: '#64748B',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  laterButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  updateButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doneButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  downloadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  downloadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
});
