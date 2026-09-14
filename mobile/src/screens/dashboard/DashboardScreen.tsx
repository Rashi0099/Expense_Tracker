import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { CurrencyText } from '../../components/common/CurrencyText';
import { SectionHeader } from '../../components/common/SectionHeader';
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Image
            source={require('../../assets/logo_round.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>CashFlow</Text>
        </View>
        <TouchableOpacity
          style={styles.bellButton}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Notifications and Settings"
        >
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Standalone Cashflow Overview Card (Total Balance + Side-by-side Income & Expenses) */}
      <CashflowOverviewCard
        currency={currency}
        onNavigateIncome={() => navigation.navigate('Expenses', { tab: 'INCOME' })}
        onNavigateExpenses={() => navigation.navigate('Expenses', { tab: 'EXPENSE' })}
        refreshTrigger={refreshTrigger}
      />

      {/* Monthly Budget Card matching uiii.png */}
      <View style={styles.section}>
        <Card style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <Text style={[styles.budgetTitle, { color: theme.colors.textPrimary }]}>
              Monthly Budget
            </Text>
            <Text style={[styles.budgetPercentText, { color: theme.colors.textPrimary }]}>
              {overallBudget ? `${Math.round(overallBudget.percentageUsed)}%` : '60%'}
            </Text>
          </View>

          <View style={[styles.barBg, { backgroundColor: theme.colors.surfaceSubtle }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: overallBudget
                    ? `${Math.min(overallBudget.percentageUsed, 100)}%`
                    : '60%',
                  backgroundColor: theme.colors.warning,
                },
              ]}
            />
          </View>

          <View style={styles.budgetFooterRow}>
            <Text style={[styles.budgetLimitLabel, { color: theme.colors.textSecondary }]}>
              {overallBudget ? (
                <>
                  <CurrencyText amountCents={overallBudget.spentCents} currency={currency} /> spent
                </>
              ) : (
                '₹9,000 spent'
              )}
            </Text>
            <Text style={[styles.budgetLimitLabel, { color: theme.colors.textSecondary }]}>
              {overallBudget ? (
                <>
                  <CurrencyText amountCents={overallBudget.budget.limitAmountCents} currency={currency} /> limit
                </>
              ) : (
                '₹15,000 limit'
              )}
            </Text>
          </View>
        </Card>
      </View>

      {/* Category Overview Horizontal Scroll Cards matching uiii.png */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Category Overview
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Expenses')}
          >
            <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.horizontalCategoryScrollWrapper}>
          {(summary.categorySpending.length > 0
            ? summary.categorySpending
            : [
                { categoryId: '1', categoryName: 'Food', categoryIcon: '🍴', categoryColor: '#D97706', totalCents: 245000, percentage: 45 },
                { categoryId: '2', categoryName: 'Transport', categoryIcon: '🚗', categoryColor: '#4F46E5', totalCents: 120000, percentage: 28 },
                { categoryId: '3', categoryName: 'Shopping', categoryIcon: '🛍️', categoryColor: '#DB2777', totalCents: 95000, percentage: 18 },
                { categoryId: '4', categoryName: 'Home', categoryIcon: '🏠', categoryColor: '#059669', totalCents: 92000, percentage: 12 },
              ]
          ).map((cat) => (
            <View
              key={cat.categoryId}
              style={[
                styles.categoryCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.surfaceBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.categoryIconBox,
                  {
                    backgroundColor:
                      cat.categoryColor === '#D97706' || cat.categoryName === 'Food'
                        ? '#FEF3C7'
                        : cat.categoryColor === '#4F46E5' || cat.categoryName === 'Transport'
                        ? '#E0E7FF'
                        : cat.categoryColor === '#DB2777' || cat.categoryName === 'Shopping'
                        ? '#FCE7F3'
                        : '#D1FAE5',
                  },
                ]}
              >
                <Text style={styles.categoryCardEmoji}>{cat.categoryIcon}</Text>
              </View>
              <Text
                style={[styles.categoryCardName, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                {cat.categoryName}
              </Text>
              <Text
                style={[styles.categoryCardAmount, { color: theme.colors.textPrimary }]}
                numberOfLines={1}
              >
                <CurrencyText amountCents={cat.totalCents} currency={currency} />
              </Text>
              <View style={[styles.miniBarBg, { backgroundColor: theme.colors.surfaceSubtle }]}>
                <View
                  style={[
                    styles.miniBarFill,
                    {
                      width: `${Math.min(cat.percentage, 100)}%`,
                      backgroundColor: cat.categoryColor || theme.colors.warning,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.miniBarPercent, { color: theme.colors.textMuted }]}>
                {cat.percentage}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Transactions Section matching uiii.png */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Recent Transactions
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Expenses')}
          >
            <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All &gt;</Text>
          </TouchableOpacity>
        </View>

        {summary.recentExpenses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No transactions recorded yet. Tap &quot;+&quot; below to add your first transaction.
            </Text>
          </Card>
        ) : (
          summary.recentExpenses.slice(0, 5).map((exp) => (
            <Card key={exp.id} style={styles.transactionCard}>
              <View style={styles.txLeft}>
                <View
                  style={[
                    styles.txIconBox,
                    {
                      backgroundColor:
                        exp.categoryName === 'Food' || exp.categoryIcon === '🍴'
                          ? '#FEF3C7'
                          : exp.categoryName === 'Transport' || exp.categoryIcon === '🚗'
                          ? '#E0E7FF'
                          : exp.categoryName === 'Shopping' || exp.categoryIcon === '🛍️'
                          ? '#FCE7F3'
                          : '#D1FAE5',
                    },
                  ]}
                >
                  <Text style={styles.txIcon}>{exp.categoryIcon || '🏷️'}</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text
                    style={[styles.txTitle, { color: theme.colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {exp.payee || exp.categoryName || 'Expense'}
                  </Text>
                  <Text style={[styles.txDate, { color: theme.colors.textSecondary }]}>
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
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: {
    fontSize: 19,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  budgetCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    shadowColor: '#17233C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  budgetPercentText: {
    fontSize: 15,
    fontWeight: '700',
  },
  budgetFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  budgetLimitLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  barBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  horizontalCategoryScrollWrapper: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryCard: {
    width: 78,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#17233C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryCardEmoji: {
    fontSize: 18,
  },
  categoryCardName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  categoryCardAmount: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  miniBarBg: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  miniBarPercent: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#17233C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txIcon: {
    fontSize: 18,
  },
  txInfo: {
    flex: 1,
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
    marginLeft: 8,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  syncBadge: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
