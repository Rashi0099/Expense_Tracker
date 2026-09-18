import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import {
  getCashflowMetricsUseCase,
  getBalanceTrendUseCase,
  CashflowMetrics,
} from '../../../domain/usecases/dashboardUseCases';
import { formatCurrencyFromCents } from '../../../utils/money';
import { DataEvents } from '../../../database/sqlite/DataEvents';
import { useTheme } from '../../../theme/useTheme';
import { SparklineChart } from '../../../components/common/SparklineChart';

export type DashboardFilter = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_3_MONTHS' | 'THIS_YEAR' | 'ALL_TIME';

export const FILTER_OPTIONS: { label: string; value: DashboardFilter }[] = [
  { label: 'This Week', value: 'THIS_WEEK' },
  { label: 'This Month', value: 'THIS_MONTH' },
  { label: '3 Months', value: 'LAST_3_MONTHS' },
  { label: 'This Year', value: 'THIS_YEAR' },
  { label: 'All Time', value: 'ALL_TIME' },
];

export const FILTER_LABELS: Record<DashboardFilter, string> = {
  THIS_WEEK: 'This Week',
  THIS_MONTH: 'This Month',
  LAST_3_MONTHS: '3 Months',
  THIS_YEAR: 'This Year',
  ALL_TIME: 'All Time',
};

export function getDateRangeForFilter(filter: DashboardFilter): { startDate?: string; endDate?: string } {
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

export interface CashflowOverviewCardProps {
  currency?: string;
  walletId?: string;
  onNavigateIncome?: () => void;
  onNavigateExpenses?: () => void;
  onFilterChange?: (filter: DashboardFilter) => void;
  refreshTrigger?: number;
}

export const CashflowOverviewCard: React.FC<CashflowOverviewCardProps> = memo(({
  currency = 'USD',
  walletId,
  onNavigateIncome,
  onNavigateExpenses,
  onFilterChange,
  refreshTrigger = 0,
}) => {
  const { isDark, theme } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState<DashboardFilter>('THIS_MONTH');
  const [showDropdown, setShowDropdown] = useState(false);
  const pillRef = useRef<View>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 120, right: 16 });
  const [metrics, setMetrics] = useState<CashflowMetrics>({
    netBalanceCents: 0,
    totalIncomeCents: 0,
    totalExpensesCents: 0,
  });
  const [trendData, setTrendData] = useState<number[]>([]);

  // Fast isolated metrics query without reloading whole screen
  const fetchMetrics = useCallback(async (filter: DashboardFilter) => {
    try {
      const dateRange = getDateRangeForFilter(filter);
      const [res, trend] = await Promise.all([
        getCashflowMetricsUseCase(dateRange, walletId),
        dateRange.startDate && dateRange.endDate
          ? getBalanceTrendUseCase({ startDate: dateRange.startDate, endDate: dateRange.endDate }, 14, walletId)
          : Promise.resolve([]),
      ]);
      setMetrics(res);
      setTrendData(trend);
    } catch {
      // Handled
    }
  }, [walletId]);

  // Initial load and filter updates
  useEffect(() => {
    fetchMetrics(selectedFilter);
  }, [fetchMetrics, selectedFilter, refreshTrigger, walletId]);

  // Reactive updates on transaction and wallet changes
  useEffect(() => {
    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', () => fetchMetrics(selectedFilter));
    const unsubInc = DataEvents.subscribe('INCOME_CHANGED', () => fetchMetrics(selectedFilter));
    const unsubWallets = DataEvents.subscribe('WALLETS_CHANGED', () => fetchMetrics(selectedFilter));
    return () => {
      unsubExp();
      unsubInc();
      unsubWallets();
    };
  }, [fetchMetrics, selectedFilter]);

  const handleOpenDropdown = () => {
    if (pillRef.current && (pillRef.current as any).measureInWindow) {
      (pillRef.current as any).measureInWindow((x: number, y: number, width: number, height: number) => {
        if (y && !isNaN(y)) {
          const windowWidth = Dimensions.get('window').width;
          setDropdownPos({
            top: y + height + 6,
            right: Math.max(16, windowWidth - (x + width)),
          });
        }
        setShowDropdown(true);
      });
    } else {
      setShowDropdown(true);
    }
  };

  const handleSelectFilter = (filter: DashboardFilter) => {
    setSelectedFilter(filter);
    setShowDropdown(false);
    if (onFilterChange) {
      onFilterChange(filter);
    }
  };

  const [isBalanceHidden, setIsBalanceHidden] = useState(false);

  return (
    <View style={styles.outerContainer}>
      {/* 1. Total Balance Card */}
      <View
        style={[
          styles.balanceCard,
          {
            backgroundColor: isDark ? '#161F35' : '#FFFDF8',
            borderColor: isDark ? '#263352' : '#E7D788',
            shadowOpacity: isDark ? 0.3 : 0.06,
          },
        ]}
      >
        {/* Top Header Row */}
        <View style={styles.cardHeaderRow}>
          {/* Left: Total Balance label + Eye Icon */}
          <TouchableOpacity
            onPress={() => setIsBalanceHidden((prev) => !prev)}
            activeOpacity={0.7}
            style={styles.balanceLabelRow}
            accessibilityRole="button"
            accessibilityLabel="Toggle balance visibility"
          >
            <Text
              style={[
                styles.balanceLabel,
                { color: isDark ? '#E8EDF8' : '#17233C' },
              ]}
            >
              Total Balance
            </Text>
            <Text style={styles.eyeIcon}>{isBalanceHidden ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>

          {/* Right: Fast Inline Filter Dropdown */}
          <View ref={pillRef} collapsable={false} style={styles.filterPillWrapper}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenDropdown}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isDark ? '#1C2840' : '#F7F1E5',
                  borderColor: isDark ? '#263352' : '#E7D788',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${FILTER_LABELS[selectedFilter]}`}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: isDark ? '#E8EDF8' : '#17233C' },
                ]}
              >
                {FILTER_LABELS[selectedFilter]}
              </Text>
              <Text
                style={[
                  styles.filterPillChevron,
                  { color: isDark ? '#9AAAC8' : '#718096' },
                ]}
              >
                {showDropdown ? '▴' : '▾'}
              </Text>
            </TouchableOpacity>

            {/* Zero-Delay Native Modal Dropdown Menu */}
            <Modal
              transparent
              visible={showDropdown}
              animationType="none"
              onRequestClose={() => setShowDropdown(false)}
              statusBarTranslucent
            >
              <TouchableOpacity
                style={styles.modalBackdrop}
                activeOpacity={1}
                onPress={() => setShowDropdown(false)}
              >
                <View
                  style={[
                    styles.dropdownMenu,
                    {
                      top: dropdownPos.top,
                      right: dropdownPos.right,
                      backgroundColor: isDark ? '#161F35' : '#FFFDF8',
                      borderColor: isDark ? '#263352' : '#E7D788',
                      shadowOpacity: isDark ? 0.45 : 0.12,
                    },
                  ]}
                >
                  {FILTER_OPTIONS.map((opt) => {
                    const isSelected = opt.value === selectedFilter;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => handleSelectFilter(opt.value)}
                        activeOpacity={0.6}
                        style={[
                          styles.dropdownItem,
                          isSelected && {
                            backgroundColor: isDark
                              ? 'rgba(79, 142, 247, 0.20)'
                              : 'rgba(29, 88, 66, 0.12)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected
                              ? { color: isDark ? '#4F8EF7' : '#1D5842', fontWeight: '700' }
                              : { color: isDark ? '#9AAAC8' : '#475569', fontWeight: '500' },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {isSelected && (
                          <Text style={[styles.dropdownItemCheck, { color: isDark ? '#4F8EF7' : '#1D5842' }]}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        </View>

        {/* Balance Amount & Trend with Wave Illustration */}
        <View style={styles.balanceBodyRow}>
          <View style={styles.balanceAmountColumn}>
            <Text
              style={[
                styles.balanceBigNumber,
                { color: isDark ? '#FFFFFF' : '#17233C' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {isBalanceHidden
                ? '••••••••'
                : formatCurrencyFromCents(metrics.netBalanceCents, currency)}
            </Text>
            <View style={styles.trendRow}>
              <Text style={styles.trendArrow}>↑</Text>
              <Text style={styles.trendText}>12% from last month</Text>
            </View>
          </View>

          {/* Real sparkline area chart - golden area graph */}
          {trendData.length >= 2 ? (
            <SparklineChart
              data={trendData}
              width={100}
              height={48}
              lineColor={isDark ? '#E6B840' : '#D99A27'}
              fillColor={isDark ? 'rgba(230,184,64,0.18)' : 'rgba(217,154,39,0.12)'}
              strokeWidth={2.5}
            />
          ) : (
            <View style={styles.waveContainer}>
              <View style={[styles.waveCurve1, { borderColor: isDark ? '#92400E' : '#D99A27' }]} />
              <View style={[styles.waveCurve2, { borderColor: isDark ? '#78350F' : '#E7D788' }]} />
            </View>
          )}
        </View>
      </View>

      {/* 2. Side-by-Side Income & Expenses Cards */}
      <View style={styles.metricsRow}>
        {/* Income Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onNavigateIncome}
          style={[
            styles.metricCard,
            {
              backgroundColor: isDark ? '#161F35' : '#FFFDF8',
              borderColor: isDark ? '#263352' : '#E7D788',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="View income streams"
        >
          <View style={styles.incomeBadge}>
            <Text style={styles.incomeArrow}>↑</Text>
          </View>
          <View style={styles.metricTexts}>
            <Text style={[styles.metricLabel, { color: isDark ? '#9AAAC8' : '#718096' }]}>
              Income
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#17233C' }]}
            >
              {isBalanceHidden
                ? '••••'
                : formatCurrencyFromCents(metrics.totalIncomeCents, currency)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Expenses Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onNavigateExpenses}
          style={[
            styles.metricCard,
            {
              backgroundColor: isDark ? '#161F35' : '#FFFDF8',
              borderColor: isDark ? '#263352' : '#E7D788',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="View expense items"
        >
          <View style={styles.expenseBadge}>
            <Text style={styles.expenseArrow}>↓</Text>
          </View>
          <View style={styles.metricTexts}>
            <Text style={[styles.metricLabel, { color: isDark ? '#9AAAC8' : '#718096' }]}>
              Expenses
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.metricValue, { color: '#E05D6A' }]}
            >
              {isBalanceHidden
                ? '••••'
                : formatCurrencyFromCents(metrics.totalExpensesCents, currency)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

CashflowOverviewCard.displayName = 'CashflowOverviewCard';

const styles = StyleSheet.create({
  outerContainer: {
    marginBottom: 16,
  },
  balanceCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#17233C',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  eyeIcon: {
    fontSize: 15,
  },
  filterPillWrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 5,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillChevron: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    width: 140,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 5,
    shadowColor: '#17233C',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 16,
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
  dropdownItemText: {
    fontSize: 12,
  },
  dropdownItemCheck: {
    fontSize: 11,
    fontWeight: '800',
  },
  balanceBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  balanceAmountColumn: {
    flex: 1,
  },
  balanceBigNumber: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  trendArrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A085',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A085',
  },
  waveContainer: {
    width: 80,
    height: 40,
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  waveCurve1: {
    width: 70,
    height: 35,
    borderBottomWidth: 2.5,
    borderRightWidth: 2,
    borderRadius: 30,
    position: 'absolute',
    bottom: 2,
    right: 0,
    opacity: 0.8,
  },
  waveCurve2: {
    width: 50,
    height: 25,
    borderBottomWidth: 1.5,
    borderRadius: 20,
    position: 'absolute',
    bottom: 0,
    right: 15,
    opacity: 0.5,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#17233C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  incomeBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E8F8F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  incomeArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16A085',
  },
  expenseBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FDE8E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  expenseArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E05D6A',
  },
  metricTexts: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
  },
});
