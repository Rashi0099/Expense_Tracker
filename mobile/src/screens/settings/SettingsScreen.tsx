import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';
import { ENV } from '../../app/config/env';
import { NotificationService, NotificationSettings } from '../../services/notificationService';
import { hotUpdateService, UpdateCheckResult } from '../../services/HotUpdateService';
import { HotUpdateModal } from '../../components/common/HotUpdateModal';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    recurringRemindersEnabled: true,
    budgetAlertsEnabled: true,
  });

  const [appVersion, setAppVersion] = useState<string>(ENV.CLIENT_VERSION);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    async function loadNotifSettings() {
      const service = NotificationService.getInstance();
      await service.init();
      setNotifSettings(service.getSettings());
    }
    loadNotifSettings();

    async function checkOta() {
      const ver = await hotUpdateService.getCurrentVersion();
      setAppVersion(ver);
      const res = await hotUpdateService.checkForUpdate();
      if (res.isAvailable) {
        setUpdateInfo(res);
        setShowUpdateModal(true);
      }
    }
    checkOta();
  }, []);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await hotUpdateService.checkForUpdate();
      if (res.isAvailable) {
        setUpdateInfo(res);
        setShowUpdateModal(true);
      } else {
        Alert.alert(
          'Up to Date',
          `You are already running the latest version (v${res.currentVersion}).`,
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert('Update Check Failed', 'Could not connect to the update server.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const toggleRecurringReminders = async () => {
    const updated = !notifSettings.recurringRemindersEnabled;
    const newSettings = { ...notifSettings, recurringRemindersEnabled: updated };
    setNotifSettings(newSettings);
    await NotificationService.getInstance().updateSettings({ recurringRemindersEnabled: updated });
  };

  const toggleBudgetAlerts = async () => {
    const updated = !notifSettings.budgetAlertsEnabled;
    const newSettings = { ...notifSettings, budgetAlertsEnabled: updated };
    setNotifSettings(newSettings);
    await NotificationService.getInstance().updateSettings({ budgetAlertsEnabled: updated });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Settings</Text>
      </View>

      {/* Account Info Card */}
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          Account Details
        </Text>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            {user?.phoneNumber ? 'Phone Number' : 'Email'}
          </Text>
          <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
            {user?.phoneNumber || user?.email || 'N/A'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Base Currency</Text>
          <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
            {user?.baseCurrency || 'USD'}
          </Text>
        </View>
      </Card>

      {/* Feature Management Links */}
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          Manage Features
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('Income')}
          style={styles.menuRow}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>💼</Text>
            <View>
              <Text style={[styles.menuTitle, { color: theme.colors.textPrimary }]}>
                Income Streams
              </Text>
              <Text style={[styles.menuSubtitle, { color: theme.colors.textMuted }]}>
                Salary, freelance, investment revenue
              </Text>
            </View>
          </View>
          <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>›</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.colors.surfaceBorder }]} />

        <TouchableOpacity
          onPress={() => navigation.navigate('Categories')}
          style={styles.menuRow}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🏷️</Text>
            <View>
              <Text style={[styles.menuTitle, { color: theme.colors.textPrimary }]}>
                Category Manager
              </Text>
              <Text style={[styles.menuSubtitle, { color: theme.colors.textMuted }]}>
                Custom labels, colors, and emoji icons
              </Text>
            </View>
          </View>
          <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>›</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.colors.surfaceBorder }]} />

        <TouchableOpacity
          onPress={() => navigation.navigate('Recurring')}
          style={styles.menuRow}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🔁</Text>
            <View>
              <Text style={[styles.menuTitle, { color: theme.colors.textPrimary }]}>
                Recurring Subscriptions
              </Text>
              <Text style={[styles.menuSubtitle, { color: theme.colors.textMuted }]}>
                Netflix, gym, monthly rent schedules
              </Text>
            </View>
          </View>
          <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </Card>

      {/* In-App Updates (OTA) Card */}
      <Card style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.textMuted, marginBottom: 2 }]}>
              In-App Updates (OTA)
            </Text>
            <Text style={[styles.label, { color: theme.colors.textSecondary, fontSize: 12 }]}>
              Current Version: v{appVersion}
            </Text>
          </View>
          <Button
            label={isCheckingUpdate ? 'Checking...' : 'Check Update'}
            variant="outline"
            size="sm"
            isLoading={isCheckingUpdate}
            onPress={handleCheckUpdate}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.surfaceBorder }]} />
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Update Channel</Text>
          <Text style={[styles.value, { color: theme.colors.primary, fontWeight: '600' }]}>
            Direct Over-The-Air (EC2)
          </Text>
        </View>
      </Card>

      {/* Notification Preferences Card */}
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          Notifications & Alerts
        </Text>
        <View style={styles.row}>
          <View style={styles.notifTextContainer}>
            <Text style={[styles.label, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
              Recurring Bill Reminders
            </Text>
            <Text style={[styles.notifSubtitle, { color: theme.colors.textMuted }]}>
              Notify when subscriptions or recurring expenses are due
            </Text>
          </View>
          <Switch
            value={notifSettings.recurringRemindersEnabled}
            onValueChange={toggleRecurringReminders}
            trackColor={{ false: theme.colors.surfaceBorder, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
            accessibilityRole="switch"
            accessibilityLabel="Toggle recurring bill reminders"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.surfaceBorder }]} />

        <View style={styles.row}>
          <View style={styles.notifTextContainer}>
            <Text style={[styles.label, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
              Budget Threshold Warnings
            </Text>
            <Text style={[styles.notifSubtitle, { color: theme.colors.textMuted }]}>
              Alert when monthly spending reaches 80% or 100% of ceiling
            </Text>
          </View>
          <Switch
            value={notifSettings.budgetAlertsEnabled}
            onValueChange={toggleBudgetAlerts}
            trackColor={{ false: theme.colors.surfaceBorder, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
            accessibilityRole="switch"
            accessibilityLabel="Toggle budget threshold warnings"
          />
        </View>
      </Card>



      {/* Preferences Card */}
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>Appearance</Text>
        <View style={styles.row}>
          <View style={styles.notifTextContainer}>
            <Text style={[styles.label, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
              Dark Mode
            </Text>
            <Text style={[styles.notifSubtitle, { color: theme.colors.textMuted }]}>
              {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.colors.surfaceBorder, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
            accessibilityRole="switch"
            accessibilityLabel="Toggle dark mode theme"
          />
        </View>
      </Card>

      {/* Sign out action */}
      <Button
        label="Sign Out"
        variant="danger"
        size="md"
        onPress={handleSignOut}
        style={styles.signOutButton}
      />

      {/* In-App OTA Update Modal */}
      <HotUpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onDismiss={async () => {
          setShowUpdateModal(false);
          const ver = await hotUpdateService.getCurrentVersion();
          setAppVersion(ver);
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  card: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorRow: {
    paddingVertical: 6,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signOutButton: {
    marginTop: 8,
    marginBottom: 32,
  },
  notifTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  notifSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
