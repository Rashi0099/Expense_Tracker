import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { BottomSheet } from '../../components/common/BottomSheet';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';
import { ENV } from '../../app/config/env';
import { NotificationService, NotificationSettings } from '../../services/notificationService';
import { reminderService } from '../../services/reminderService';
import { hotUpdateService, UpdateCheckResult } from '../../services/HotUpdateService';
import { HotUpdateModal } from '../../components/common/HotUpdateModal';
import { getCurrencySymbol } from '../../utils/money';

const AVAILABLE_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
];

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, logout, updateBaseCurrency } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    recurringRemindersEnabled: true,
    budgetAlertsEnabled: true,
  });

  const [appVersion, setAppVersion] = useState<string>(ENV.CLIENT_VERSION);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const [dailyRemindersEnabled, setDailyRemindersEnabled] = useState(true);

  useEffect(() => {
    async function loadNotifSettings() {
      const service = NotificationService.getInstance();
      await service.init();
      setNotifSettings(service.getSettings());
      setDailyRemindersEnabled(reminderService.isDailyRemindersEnabled());
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

  const toggleDailyReminders = async () => {
    const updated = !dailyRemindersEnabled;
    setDailyRemindersEnabled(updated);
    await reminderService.setDailyRemindersEnabled(updated);
  };

  const handleSendTestNotification = async () => {
    const success = await reminderService.sendTestNotification('NIGHT');
    if (success) {
      Alert.alert('Notification Sent', 'Check your device notification tray!');
    } else {
      Alert.alert('Notification Info', 'Ensure notification permission is granted in device settings.');
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
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => setIsCurrencyModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Change base currency. Current currency is ${user?.baseCurrency || 'INR'}`}
        >
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Base Currency</Text>
          <View style={styles.currencyValueRight}>
            <Text style={[styles.value, { color: theme.colors.primary, fontWeight: '700' }]}>
              {user?.baseCurrency || 'INR'} ({getCurrencySymbol(user?.baseCurrency || 'INR')})
            </Text>
            <Text style={[styles.chevronSmall, { color: theme.colors.textMuted }]}>›</Text>
          </View>
        </TouchableOpacity>
      </Card>

      {/* Feature Management Links */}
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          Manage Features
        </Text>

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

        <View style={[styles.divider, { backgroundColor: theme.colors.surfaceBorder }]} />

        <View style={styles.row}>
          <View style={styles.notifTextContainer}>
            <Text style={[styles.label, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
              Daily Expense Reminders
            </Text>
            <Text style={[styles.notifSubtitle, { color: theme.colors.textMuted }]}>
              Morning (9 AM), Afternoon (2 PM), & Night (9 PM) reminders
            </Text>
          </View>
          <Switch
            value={dailyRemindersEnabled}
            onValueChange={toggleDailyReminders}
            trackColor={{ false: theme.colors.surfaceBorder, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
            accessibilityRole="switch"
            accessibilityLabel="Toggle 3x daily expense reminders"
          />
        </View>

        <TouchableOpacity
          style={[styles.testNotifButton, { borderColor: theme.colors.surfaceBorder }]}
          onPress={handleSendTestNotification}
          activeOpacity={0.7}
        >
          <Text style={[styles.testNotifText, { color: theme.colors.primary }]}>
            🔔 Send Test Reminder Notification
          </Text>
        </TouchableOpacity>
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

      {/* Base Currency Selection Bottom Sheet */}
      <BottomSheet
        visible={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
        title="Select Base Currency"
      >
        <View style={styles.currencyListContainer}>
          {AVAILABLE_CURRENCIES.map((item) => {
            const isSelected = (user?.baseCurrency || 'INR') === item.code;
            return (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.currencyRow,
                  {
                    backgroundColor: isSelected
                      ? `${theme.colors.primary}18`
                      : theme.colors.surfaceSubtle,
                    borderColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.surfaceBorder,
                  },
                ]}
                activeOpacity={0.7}
                onPress={async () => {
                  await updateBaseCurrency(item.code);
                  setIsCurrencyModalOpen(false);
                }}
              >
                <View style={styles.currencyLeft}>
                  <View
                    style={[
                      styles.currencySymbolBadge,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencySymbolText,
                        { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                      ]}
                    >
                      {item.symbol}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.currencyCodeText,
                        {
                          color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {item.code}
                    </Text>
                    <Text style={[styles.currencyNameText, { color: theme.colors.textMuted }]}>
                      {item.name}
                    </Text>
                  </View>
                </View>
                {isSelected && (
                  <Text style={[styles.checkmarkText, { color: theme.colors.primary }]}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
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
  testNotifButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testNotifText: {
    fontSize: 13,
    fontWeight: '700',
  },
  currencyValueRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronSmall: {
    fontSize: 18,
    fontWeight: '600',
  },
  currencyListContainer: {
    gap: 8,
    paddingBottom: 16,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currencySymbolBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencySymbolText: {
    fontSize: 16,
    fontWeight: '700',
  },
  currencyCodeText: {
    fontSize: 15,
  },
  currencyNameText: {
    fontSize: 12,
    marginTop: 1,
  },
  checkmarkText: {
    fontSize: 18,
    fontWeight: '800',
  },
});
