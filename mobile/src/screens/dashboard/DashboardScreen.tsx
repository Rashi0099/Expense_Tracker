import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { CurrencyText } from '../../components/common/CurrencyText';
import { SectionHeader } from '../../components/common/SectionHeader';
import {
  getDashboardSummaryUseCase,
  DashboardSummary,
  UnifiedTransaction,
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
import { APP_LOGO } from '../../assets/appLogo';
import { CashflowOverviewCard } from './components/CashflowOverviewCard';
import { IncomeExpenseTrendCard } from './components/IncomeExpenseTrendCard';
import { useWallet } from '../../app/providers/WalletProvider';
import { useBalanceVisibility } from '../../app/providers/BalanceVisibilityProvider';
import { IconWallet } from '../../components/common/NavIcons';
import { BottomSheet } from '../../components/common/BottomSheet';

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { isOffline } = useNetworkState();
  const { syncNow } = useSync();
  const { activeWallet, activeWalletId, wallets, setActiveWalletId } = useWallet();
  const { isBalanceHidden } = useBalanceVisibility();

  const [showWalletModal, setShowWalletModal] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary>({
    netBalanceCents: 0,
    totalIncomeCents: 0,
    totalExpensesCents: 0,
    recentExpenses: [],
    recentIncome: [],
    recentTransactions: [],
    categorySpending: [],
    pendingSyncCount: 0,
  });

  const [budgetOverview, setBudgetOverview] = useState<MonthlyBudgetOverview | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sum, budget] = await Promise.all([
        getDashboardSummaryUseCase(undefined, activeWalletId || undefined),
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
  }, [activeWalletId]);

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
    const unsubWal = DataEvents.subscribe('WALLETS_CHANGED', handleDataChange);
    return () => {
      unsubExp();
      unsubInc();
      unsubBud();
      unsubWal();
    };
  }, [loadData]);

  const currency = user?.baseCurrency || 'INR';
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
            source={APP_LOGO}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Spending Book</Text>
        </View>

        {/* Top-Right Wallet Switcher Button */}
        <TouchableOpacity
          style={[
            styles.walletSwitchBtn,
            {
              backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={() => setShowWalletModal(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Active wallet: ${activeWallet?.name || 'Wallet 1'}. Tap to switch.`}
        >
          <IconWallet color={theme.colors.primary} size={15} />
          <Text
            style={[styles.walletSwitchBtnText, { color: theme.colors.textPrimary }]}
            numberOfLines={1}
          >
            {activeWallet?.name || 'Wallet 1'}
          </Text>
          <Text style={[styles.walletSwitchChevron, { color: theme.colors.textMuted }]}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Standalone Cashflow Overview Card (Total Balance + Side-by-side Income & Expenses) */}
      <CashflowOverviewCard
        currency={currency}
        walletId={activeWalletId || undefined}
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

      {/* 6-Month Income vs Expenses Trend Card matching user design */}
      <IncomeExpenseTrendCard
        walletId={activeWalletId || undefined}
        refreshTrigger={refreshTrigger}
        currency={currency}
      />

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

        {summary.categorySpending.length === 0 ? (
          <View style={[styles.categoryEmptyBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}>
            <Text style={[styles.categoryEmptyText, { color: theme.colors.textMuted }]}>
              No spending data yet. Add expenses to see category overview.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCategoryScrollWrapper}
          >
            {summary.categorySpending.map((cat, idx) => {
              const pastelBgs = ['#FEF3C7', '#E0E7FF', '#FCE7F3', '#D1FAE5', '#E0F2FE', '#FEE2E2', '#EDE9FE', '#F3F4F6'];
              const tileBg = pastelBgs[idx % pastelBgs.length];
              return (
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
                  <View style={[styles.categoryIconBox, { backgroundColor: tileBg }]}>
                    <Text style={styles.categoryCardEmoji}>{cat.categoryIcon}</Text>
                  </View>
                  <Text style={[styles.categoryCardName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {cat.categoryName}
                  </Text>
                  <Text style={[styles.categoryCardAmount, { color: theme.colors.textPrimary }]} numberOfLines={1}>
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
              );
            })}
          </ScrollView>
        )}
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

        {(!summary.recentTransactions || summary.recentTransactions.length === 0) ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No transactions recorded yet. Tap &quot;+&quot; below to add your first transaction.
            </Text>
          </Card>
        ) : (
          summary.recentTransactions.map((tx) => {
            const isIncome = tx.transactionType === 'INCOME';
            const incomeItem = isIncome ? (tx as any) : null;
            const expenseItem = !isIncome ? (tx as any) : null;

            const title = isIncome
              ? incomeItem?.source || incomeItem?.categoryName || 'Income'
              : expenseItem?.payee || expenseItem?.categoryName || 'Expense';

            const subtitle = `${formatDisplayDate(tx.transactionDate)} • ${(tx.paymentMethod || 'CASH').replace('_', ' ')}`;
            const icon = tx.categoryIcon || (isIncome ? '💼' : '🏷️');

            const iconBg = isIncome
              ? '#D1FAE5'
              : tx.categoryName === 'Food' || tx.categoryIcon === '🍴'
              ? '#FEF3C7'
              : tx.categoryName === 'Transport' || tx.categoryIcon === '🚗'
              ? '#E0E7FF'
              : tx.categoryName === 'Shopping' || tx.categoryIcon === '🛍️'
              ? '#FCE7F3'
              : '#FEE2E2';

            return (
              <Card key={tx.id} style={styles.transactionCard}>
                <View style={styles.txLeft}>
                  <View style={[styles.txIconBox, { backgroundColor: iconBg }]}>
                    <Text style={styles.txIcon}>{icon}</Text>
                  </View>
                  <View style={styles.txInfo}>
                    <Text
                      style={[styles.txTitle, { color: theme.colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text style={[styles.txDate, { color: theme.colors.textSecondary }]}>
                      {subtitle}
                    </Text>
                  </View>
                </View>
                <View style={styles.txRight}>
                  <CurrencyText
                    amountCents={tx.amountCents}
                    currency={tx.currency}
                    type={isIncome ? 'income' : 'expense'}
                    showSign
                    style={styles.txAmount}
                  />
                  {tx.syncStatus === 'PENDING' && (
                    <Text style={[styles.syncBadge, { color: theme.colors.warning }]}>• Offline</Text>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </View>

      {/* Wallet Switcher BottomSheet */}
      <BottomSheet
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        title="Select Wallet"
      >
        <View style={styles.walletModalContent}>
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {wallets.map((wallet) => {
              const isSelected = wallet.id === activeWalletId;
              return (
                <TouchableOpacity
                  key={wallet.id}
                  style={[
                    styles.walletItemRow,
                    isSelected && {
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                      borderColor: isDark ? '#1D4ED8' : '#BFDBFE',
                    },
                  ]}
                  onPress={async () => {
                    await setActiveWalletId(wallet.id);
                    setShowWalletModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.walletItemLeft}>
                    <Text
                      style={[
                        styles.walletItemCheck,
                        { color: isSelected ? theme.colors.primary : 'transparent' },
                      ]}
                    >
                      ✓
                    </Text>
                    <View>
                      <Text
                        style={[
                          styles.walletItemName,
                          {
                            color: theme.colors.textPrimary,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {wallet.name}
                      </Text>
                      {wallet.isDefault && (
                        <Text style={[styles.walletItemDefaultTag, { color: theme.colors.textMuted }]}>
                          Default
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.walletItemBalance,
                      {
                        color:
                          (wallet.balanceCents || 0) >= 0
                            ? theme.colors.textPrimary
                            : theme.colors.expense,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {isBalanceHidden ? (
                      '••••'
                    ) : (
                      <CurrencyText amountCents={wallet.balanceCents || 0} currency={currency} />
                    )}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Add / Manage Wallet Button */}
          <TouchableOpacity
            style={[
              styles.manageWalletsBtn,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.surfaceBorder,
              },
            ]}
            onPress={() => {
              setShowWalletModal(false);
              navigation.navigate('Wallets');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.manageWalletsBtnText, { color: theme.colors.primary }]}>
              ⚙️ Add / Manage Wallet
            </Text>
          </TouchableOpacity>
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
    borderRadius: 8,
    overflow: 'hidden',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  walletSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  walletSwitchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 90,
  },
  walletSwitchChevron: {
    fontSize: 11,
    marginTop: 1,
  },
  walletModalContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  walletItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  walletItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletItemCheck: {
    fontSize: 16,
    fontWeight: '800',
    width: 20,
    textAlign: 'center',
  },
  walletItemName: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  walletItemDefaultTag: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  walletItemBalance: {
    fontSize: 14,
  },
  manageWalletsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  manageWalletsBtnText: {
    fontSize: 14,
    fontWeight: '700',
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
  categoryEmptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
