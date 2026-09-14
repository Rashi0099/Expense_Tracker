import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { CashflowOverviewCard } from './components/CashflowOverviewCard';

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
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
      setRefreshTrigger((prev) => prev + 1);
      await loadData();
      if (!isOffline) {
        syncNow().catch(() => {});
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const isDirtyRef = useRef(false);
  const isFocusedRef = useRef(true);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Focus tracking: Only reload on focus if data was mutated while blurred
  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      isFocusedRef.current = true;
      if (isDirtyRef.current) {
        isDirtyRef.current = false;
        loadData();
      }
    });
    const unsubBlur = navigation.addListener('blur', () => {
      isFocusedRef.current = false;
    });
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation, loadData]);

  // Reactive subscription: auto-refresh whenever local SQLite state changes
  useEffect(() => {
    const handleDataChange = () => {
      if (isFocusedRef.current) {
        loadData();
      } else {
        isDirtyRef.current = true;
      }
    };

    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', handleDataChange);
    const unsubInc = DataEvents.subscribe('INCOME_CHANGED', handleDataChange);
    const unsubBud = DataEvents.subscribe('BUDGETS_CHANGED', handleDataChange);
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
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Overview</Text>
      </View>

      {/* Standalone Cashflow Overview Card (Fast Isolated Filtering) */}
      <CashflowOverviewCard
        currency={currency}
        onNavigateIncome={() => navigation.navigate('Expenses', { tab: 'INCOME' })}
        onNavigateExpenses={() => navigation.navigate('Expenses', { tab: 'EXPENSE' })}
        refreshTrigger={refreshTrigger}
      />

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
              <View style={styles.emptyBudgetTexts}>
                <View style={styles.emptyBudgetHeader}>
                  <Text style={[styles.emptyBudgetTitle, { color: theme.colors.textPrimary }]}>
                    No monthly budget set
                  </Text>
                  <View style={[styles.emptyBudgetBadge, { backgroundColor: theme.colors.primaryLight }]}>
                    <Text style={[styles.emptyBudgetBadgeText, { color: theme.colors.primary }]}>Setup</Text>
                  </View>
                </View>
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
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
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
    padding: 16,
  },
  emptyBudgetTexts: {
    flex: 1,
  },
  emptyBudgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  emptyBudgetTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyBudgetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emptyBudgetBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBudgetSubtitle: {
    fontSize: 12,
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
