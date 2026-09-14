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
import { formatCurrencyFromCents } from '../../utils/money';
import { DataEvents } from '../../database/sqlite/DataEvents';

export type DashboardFilter = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_3_MONTHS' | 'THIS_YEAR' | 'ALL_TIME';

const FILTER_OPTIONS: { label: string; value: DashboardFilter }[] = [
  { label: 'This Week', value: 'THIS_WEEK' },
  { label: 'This Month', value: 'THIS_MONTH' },
  { label: '3 Months', value: 'LAST_3_MONTHS' },
  { label: 'This Year', value: 'THIS_YEAR' },
  { label: 'All Time', value: 'ALL_TIME' },
];

const FILTER_LABELS: Record<DashboardFilter, string> = {
  THIS_WEEK: 'This Week',
  THIS_MONTH: 'This Month',
  LAST_3_MONTHS: '3 Months',
  THIS_YEAR: 'This Year',
  ALL_TIME: 'All Time',
};

function getDateRangeForFilter(filter: DashboardFilter): { startDate?: string; endDate?: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  };

  const todayStr = toDateStr(now);

  if (filter === 'THIS_WEEK') {
    const currentDayOfWeek = now.getDay();
    const distanceToMonday = (currentDayOfWeek + 6) % 7;
    const monday = new Date(year, month, day - distanceToMonday);
    return { startDate: toDateStr(monday), endDate: todayStr };
  }

  if (filter === 'THIS_MONTH') {
    const firstDay = new Date(year, month, 1);
    return { startDate: toDateStr(firstDay), endDate: todayStr };
  }

  if (filter === 'LAST_3_MONTHS') {
    const threeMonthsAgo = new Date(year, month - 2, 1);
    return { startDate: toDateStr(threeMonthsAgo), endDate: todayStr };
  }

  if (filter === 'THIS_YEAR') {
    const firstDayOfYear = new Date(year, 0, 1);
    return { startDate: toDateStr(firstDayOfYear), endDate: todayStr };
  }

  return {};
}

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
  const [selectedFilter, setSelectedFilter] = useState<DashboardFilter>('THIS_MONTH');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(
    async (filter: DashboardFilter = selectedFilter) => {
      try {
        const dateRange = getDateRangeForFilter(filter);
        const [sum, budget] = await Promise.all([
          getDashboardSummaryUseCase(dateRange),
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
    },
    [selectedFilter]
  );

  const handleSelectFilter = (filter: DashboardFilter) => {
    setSelectedFilter(filter);
    setShowDropdown(false);
    loadData(filter);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. Immediate local SQLite query (<10ms)
      await loadData(selectedFilter);
      // 2. Concurrently initiate background sync if online
      if (!isOffline) {
        syncNow().catch(() => {});
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(selectedFilter);
    const unsubscribe = navigation.addListener('focus', () => {
      loadData(selectedFilter);
    });
    return unsubscribe;
  }, [navigation, loadData, selectedFilter]);

  // Reactive subscription: auto-refresh whenever local SQLite state changes
  useEffect(() => {
    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', () => loadData(selectedFilter));
    const unsubInc = DataEvents.subscribe('INCOME_CHANGED', () => loadData(selectedFilter));
    const unsubBud = DataEvents.subscribe('BUDGETS_CHANGED', () => loadData(selectedFilter));
    return () => {
      unsubExp();
      unsubInc();
      unsubBud();
    };
  }, [loadData, selectedFilter]);

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

      {/* Net Cashflow Balance Card matching reference UX */}
      <View style={styles.cashflowCard}>
        {/* Top Header Row */}
        <View style={styles.cardHeaderRow}>
          {/* Left: Wallet Icon Badge + Texts */}
          <View style={styles.walletAndInfo}>
            <View style={styles.walletBadge}>
              <View style={styles.walletOuter}>
                <View style={styles.walletFlap}>
                  <View style={styles.walletClaspDot} />
                </View>
              </View>
            </View>

            <View style={styles.balanceTexts}>
              <Text style={styles.balanceTag}>NET CASHFLOW BALANCE</Text>
              <Text
                style={styles.balanceBigNumber}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatCurrencyFromCents(summary.netBalanceCents, currency)}
              </Text>
              <Text style={styles.balanceSubNotice}>
                {summary.netBalanceCents < 0
                  ? "You've spent more than earned"
                  : summary.netBalanceCents > 0
                  ? "You've saved more than spent"
                  : 'Balanced cashflow'}
              </Text>
            </View>
          </View>

          {/* Right: Fast Inline Filter Dropdown */}
          <View style={styles.filterPillWrapper}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowDropdown((prev) => !prev)}
              style={styles.filterPill}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${FILTER_LABELS[selectedFilter]}`}
            >
              <Text style={styles.filterPillText}>{FILTER_LABELS[selectedFilter]}</Text>
              <Text style={styles.filterPillChevron}>{showDropdown ? '▴' : '▾'}</Text>
            </TouchableOpacity>

            {/* Fast Dropdown Menu right under pill button */}
            {showDropdown && (
              <>
                <TouchableOpacity
                  style={styles.dropdownBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowDropdown(false)}
                />
                <View style={styles.dropdownMenu}>
                  {FILTER_OPTIONS.map((opt) => {
                    const isSelected = opt.value === selectedFilter;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => handleSelectFilter(opt.value)}
                        activeOpacity={0.7}
                        style={[
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected
                              ? styles.dropdownItemTextSelected
                              : styles.dropdownItemTextNormal,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {isSelected && (
                          <Text style={styles.dropdownItemCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Divider Line */}
        <View style={styles.cardDivider} />

        {/* Bottom Metrics Row */}
        <View style={styles.cardMetricsRow}>
          {/* Total Income Item */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Income')}
            style={styles.metricHalf}
            accessibilityRole="button"
            accessibilityLabel="View income streams"
          >
            <View style={styles.incomeArrowBadge}>
              <Text style={styles.incomeArrowText}>↑</Text>
            </View>
            <View style={styles.metricTextsColumn}>
              <Text style={styles.metricLabelText}>Total Income</Text>
              <Text style={styles.incomeValueText}>
                {formatCurrencyFromCents(summary.totalIncomeCents, currency)}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Vertical Divider */}
          <View style={styles.metricVerticalDivider} />

          {/* Total Expenses Item */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Expenses')}
            style={[styles.metricHalf, styles.expenseHalf]}
            accessibilityRole="button"
            accessibilityLabel="View expense items"
          >
            <View style={styles.expenseArrowBadge}>
              <Text style={styles.expenseArrowText}>↓</Text>
            </View>
            <View style={styles.metricTextsColumn}>
              <Text style={styles.metricLabelText}>Total Expenses</Text>
              <Text style={styles.expenseValueText}>
                {formatCurrencyFromCents(summary.totalExpensesCents, currency)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

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

  cashflowCard: {
    backgroundColor: '#121626',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#232A42',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'visible',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 100,
  },
  walletAndInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: 6,
  },
  walletBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#384370',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  walletOuter: {
    width: 24,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 2,
  },
  walletFlap: {
    width: 8,
    height: 10,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRightWidth: 0,
    backgroundColor: '#384370',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletClaspDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  balanceTexts: {
    flex: 1,
  },
  balanceTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8F9BB3',
    letterSpacing: 0.6,
  },
  balanceBigNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: 2,
  },
  balanceSubNotice: {
    fontSize: 12,
    color: '#8F9BB3',
    fontWeight: '500',
  },
  filterPillWrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20273F',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterPillChevron: {
    fontSize: 10,
    color: '#8F9BB3',
    fontWeight: '700',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: -500,
    bottom: -800,
    left: -500,
    right: -500,
    zIndex: 998,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 34,
    right: 0,
    width: 125,
    backgroundColor: '#1B2138',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D385A',
    paddingVertical: 4,
    paddingHorizontal: 4,
    zIndex: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 12,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 8,
    marginVertical: 1,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
  dropdownItemText: {
    fontSize: 12,
  },
  dropdownItemTextNormal: {
    color: '#C5CEE0',
    fontWeight: '500',
  },
  dropdownItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dropdownItemCheck: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366F1',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#232A42',
    marginTop: 18,
    marginBottom: 16,
  },
  cardMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseHalf: {
    paddingLeft: 12,
  },
  incomeArrowBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 208, 156, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  incomeArrowText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00D09C',
  },
  expenseArrowBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 107, 139, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  expenseArrowText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF6B8B',
  },
  metricTextsColumn: {
    flex: 1,
  },
  metricLabelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8F9BB3',
    marginBottom: 2,
  },
  incomeValueText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#00D09C',
  },
  expenseValueText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FF6B8B',
  },
  metricVerticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#232A42',
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
