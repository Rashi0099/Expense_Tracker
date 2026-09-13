import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { CurrencyText } from '../../components/common/CurrencyText';
import { SectionHeader } from '../../components/common/SectionHeader';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { SyncStatusPill } from '../../components/common/SyncStatusPill';
import { SyncErrorBanner } from '../../components/common/SyncErrorBanner';
import {
  getDashboardSummaryUseCase,
  DashboardSummary,
} from '../../domain/usecases/dashboardUseCases';
import {
  getMonthlyBudgetOverviewUseCase,
  calculateBudgetStatus,
} from '../../domain/usecases/budgetUseCases';
import { MonthlyBudgetOverview } from '../../database/repositories/interfaces/IBudgetRepository';
import { NotificationService } from '../../services/notificationService';
import { useNetworkState } from '../../sync/network/useNetworkState';
import { useSync } from '../../sync/hooks/useSync';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';
import { formatDisplayDate, getCurrentMonthString } from '../../utils/date';
import { DataEvents } from '../../database/sqlite/DataEvents';

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isOffline } = useNetworkState();
  const { syncNow } = useSync();

  const [summary, setSummary] = useState<DashboardSummary>({
    netBalanceCents: 0,
    totalIncomeCents: 0,
    totalExpensesCents: 0,
    recentExpenses: [],
    recentIncome: [],
    categorySpending: [],
    pendingSyncCount: 0,
  });

  const [budgetOverview, setBudgetOverview] = useState<MonthlyBudgetOverview | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sum, budget] = await Promise.all([
        getDashboardSummaryUseCase(),
        getMonthlyBudgetOverviewUseCase(getCurrentMonthString()),
      ]);
      setSummary(sum);
      setBudgetOverview(budget);

      // Evaluate notifications for recurring items & budget thresholds asynchronously
      NotificationService.getInstance().checkRecurringReminders().catch(() => {});
      NotificationService.getInstance().checkBudgetAlerts().catch(() => {});
    } catch {
      // Handled
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. Immediate local SQLite query (<10ms)
      await loadData();
      // 2. Concurrently initiate background sync if online
      if (!isOffline) {
        syncNow().catch(() => {});
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, loadData]);

  // Reactive subscription: auto-refresh whenever local SQLite state changes
  useEffect(() => {
    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', () => loadData());
    const unsubInc = DataEvents.subscribe('INCOME_CHANGED', () => loadData());
    const unsubBud = DataEvents.subscribe('BUDGETS_CHANGED', () => loadData());
    return () => {
      unsubExp();
      unsubInc();
      unsubBud();
    };
  }, [loadData]);

  const currency = user?.baseCurrency || 'USD';
  const overallBudget = budgetOverview?.overallBudget;
  const budgetStatus = overallBudget ? calculateBudgetStatus(overallBudget.percentageUsed) : null;

  return (
    <Screen
      scrollable
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <OfflineBanner isOffline={isOffline} pendingCount={summary.pendingSyncCount} />
      <SyncErrorBanner />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.welcome, { color: theme.colors.textMuted }]}>
            Welcome back
          </Text>
          <Text style={[styles.email, { color: theme.colors.textPrimary }]}>
            {user?.email || 'Guest User'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <SyncStatusPill />

          <TouchableOpacity
            onPress={() => navigation.navigate('QuickAdd')}
            style={[styles.quickButton, { backgroundColor: theme.colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Add Expense"
          >
            <Text style={styles.quickButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary Hero KPI: Net Cashflow Balance */}
      <Card style={styles.balanceCard}>
        <Text style={[styles.balanceLabel, { color: theme.colors.textMuted }]}>
          Net Cashflow Balance
        </Text>
        <CurrencyText
          amountCents={summary.netBalanceCents}
          currency={currency}
          style={styles.balanceAmount}
          showSign={summary.netBalanceCents < 0}
        />
        <View style={[styles.metricRow, { borderTopColor: theme.colors.surfaceBorder }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Income')}
            style={styles.metricItem}
            accessibilityRole="button"
            accessibilityLabel="View income streams"
          >
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
              Income ›
            </Text>
            <CurrencyText
              amountCents={summary.totalIncomeCents}
              currency={currency}
              type="income"
              showSign
              style={styles.metricValue}
            />
          </TouchableOpacity>

          <View style={[styles.metricDivider, { backgroundColor: theme.colors.surfaceBorder }]} />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Expenses')}
            style={styles.metricItem}
            accessibilityRole="button"
            accessibilityLabel="View expenses list"
          >
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
              Expenses ›
            </Text>
            <CurrencyText
              amountCents={summary.totalExpensesCents}
              currency={currency}
              type="expense"
              showSign
              style={styles.metricValue}
            />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Concise Monthly Budget Status Card */}
      <View style={styles.section}>
        <SectionHeader
          title="Monthly Budget Status"
          actionText={overallBudget ? 'Manage' : 'Set Budget'}
          onActionPress={() => navigation.navigate('Budgets')}
        />
        {overallBudget ? (
          <Card style={styles.budgetCard}>
            <View style={styles.budgetHeader}>
              <View>
                <Text style={[styles.budgetLimitLabel, { color: theme.colors.textMuted }]}>
                  Monthly Spending Ceiling
                </Text>
                <Text style={[styles.budgetValue, { color: theme.colors.textPrimary }]}>
                  <CurrencyText amountCents={overallBudget.spentCents} currency={currency} /> /{' '}
                  <CurrencyText amountCents={overallBudget.budget.limitAmountCents} currency={currency} />
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      budgetStatus === 'OVER_BUDGET'
                        ? `${theme.colors.expense}15`
                        : budgetStatus === 'NEAR_LIMIT'
                        ? `${theme.colors.warning}15`
                        : `${theme.colors.income}15`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        budgetStatus === 'OVER_BUDGET'
                          ? theme.colors.expense
                          : budgetStatus === 'NEAR_LIMIT'
                          ? theme.colors.warning
                          : theme.colors.income,
                    },
                  ]}
                >
                  {budgetStatus === 'OVER_BUDGET'
                    ? 'Over Budget'
                    : budgetStatus === 'NEAR_LIMIT'
                    ? 'Near Limit'
                    : 'On Track'}
                </Text>
              </View>
            </View>

            <View style={[styles.barBg, { backgroundColor: theme.colors.surfaceSubtle }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(overallBudget.percentageUsed, 100)}%`,
                    backgroundColor:
                      budgetStatus === 'OVER_BUDGET'
                        ? theme.colors.expense
                        : budgetStatus === 'NEAR_LIMIT'
                        ? theme.colors.warning
                        : theme.colors.income,
                  },
                ]}
              />
            </View>

            <Text style={[styles.budgetRemaining, { color: theme.colors.textMuted }]}>
              {overallBudget.remainingCents >= 0
                ? `${overallBudget.percentageUsed.toFixed(0)}% used • $${(overallBudget.remainingCents / 100).toFixed(2)} remaining`
                : `${overallBudget.percentageUsed.toFixed(0)}% used • $${(Math.abs(overallBudget.remainingCents) / 100).toFixed(2)} over limit`}
            </Text>
          </Card>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Budgets')}
          >
            <Card style={styles.emptyBudgetCard}>
              <Text style={styles.emptyBudgetIcon}>🎯</Text>
              <View style={styles.emptyBudgetTexts}>
                <Text style={[styles.emptyBudgetTitle, { color: theme.colors.textPrimary }]}>
                  No monthly budget set
                </Text>
                <Text style={[styles.emptyBudgetSubtitle, { color: theme.colors.textMuted }]}>
                  Set a monthly spending limit to track allowances & alerts.
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      </View>

      {/* Top Category Spending Breakdown */}
      {summary.categorySpending.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Category Breakdown" />
          <Card style={styles.breakdownCard}>
            {summary.categorySpending.slice(0, 4).map((cat) => (
              <View key={cat.categoryId} style={styles.breakdownRow}>
                <View style={styles.breakdownHeader}>
                  <View style={styles.catTitleLeft}>
                    <Text style={styles.catEmoji}>{cat.categoryIcon}</Text>
                    <Text style={[styles.catName, { color: theme.colors.textPrimary }]}>
                      {cat.categoryName}
                    </Text>
                  </View>
                  <Text style={[styles.catPercent, { color: theme.colors.textMuted }]}>
                    {cat.percentage}% (<CurrencyText amountCents={cat.totalCents} currency={currency} />)
                  </Text>
                </View>
                <View style={[styles.barBg, { backgroundColor: theme.colors.surfaceSubtle }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${cat.percentage}%`,
                        backgroundColor: cat.categoryColor || theme.colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Recent Activity Feed */}
      <View style={styles.section}>
        <SectionHeader
          title="Recent Transactions"
          actionText="View All"
          onActionPress={() => navigation.navigate('Expenses')}
        />
        {summary.recentExpenses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No expenses recorded locally yet. Tap "+ Add" to save your first expense.
            </Text>
          </Card>
        ) : (
          summary.recentExpenses.slice(0, 4).map((exp) => (
            <Card key={exp.id} style={styles.transactionCard}>
              <View style={styles.txLeft}>
                <View
                  style={[
                    styles.txIconBox,
                    {
                      backgroundColor: exp.categoryColor
                        ? `${exp.categoryColor}25`
                        : theme.colors.surfaceSubtle,
                    },
                  ]}
                >
                  <Text style={styles.txIcon}>{exp.categoryIcon || '🏷️'}</Text>
                </View>
                <View>
                  <Text style={[styles.txTitle, { color: theme.colors.textPrimary }]}>
                    {exp.payee || exp.categoryName || 'Expense'}
                  </Text>
                  <Text style={[styles.txDate, { color: theme.colors.textMuted }]}>
                    {formatDisplayDate(exp.transactionDate)} • {exp.paymentMethod}
                  </Text>
                </View>
              </View>
              <View style={styles.txRight}>
                <CurrencyText
                  amountCents={exp.amountCents}
                  currency={exp.currency}
                  type="expense"
                  showSign
                  style={styles.txAmount}
                />
                {exp.syncStatus === 'PENDING' && (
                  <Text style={[styles.syncBadge, { color: theme.colors.warning }]}>• Offline</Text>
                )}
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  welcome: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  email: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
  },
  quickButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  balanceCard: {
    marginBottom: 20,
    padding: 20,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metricItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  metricDivider: {
    width: 1,
    height: 28,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 15,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  budgetCard: {
    padding: 16,
    gap: 10,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetLimitLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  budgetValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  budgetRemaining: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyBudgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  emptyBudgetIcon: {
    fontSize: 24,
  },
  emptyBudgetTexts: {
    flex: 1,
  },
  emptyBudgetTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyBudgetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  breakdownCard: {
    padding: 16,
    gap: 12,
  },
  breakdownRow: {
    gap: 6,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catEmoji: {
    fontSize: 15,
    marginRight: 6,
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
  },
  catPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txIcon: {
    fontSize: 18,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txDate: {
    fontSize: 12,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
  },
  syncBadge: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
