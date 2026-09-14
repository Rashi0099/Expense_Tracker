import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  getCashflowMetricsUseCase,
  CashflowMetrics,
} from '../../../domain/usecases/dashboardUseCases';
import { formatCurrencyFromCents } from '../../../utils/money';
import { DataEvents } from '../../../database/sqlite/DataEvents';
import { useTheme } from '../../../theme/useTheme';

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
  onNavigateIncome?: () => void;
  onNavigateExpenses?: () => void;
  onFilterChange?: (filter: DashboardFilter) => void;
  refreshTrigger?: number;
}

export const CashflowOverviewCard: React.FC<CashflowOverviewCardProps> = memo(({
  currency = 'USD',
  onNavigateIncome,
  onNavigateExpenses,
  onFilterChange,
  refreshTrigger = 0,
}) => {
  const { isDark } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState<DashboardFilter>('THIS_MONTH');
  const [showDropdown, setShowDropdown] = useState(false);
  const [metrics, setMetrics] = useState<CashflowMetrics>({
    netBalanceCents: 0,
    totalIncomeCents: 0,
    totalExpensesCents: 0,
  });

  // Fast isolated metrics query without reloading whole screen
  const fetchMetrics = useCallback(async (filter: DashboardFilter) => {
    try {
      const dateRange = getDateRangeForFilter(filter);
      const res = await getCashflowMetricsUseCase(dateRange);
      setMetrics(res);
    } catch {
      // Handled
    }
  }, []);

  // Initial load and filter updates
  useEffect(() => {
    fetchMetrics(selectedFilter);
  }, [fetchMetrics, selectedFilter, refreshTrigger]);

  // Reactive updates on transaction changes
  useEffect(() => {
    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', () => fetchMetrics(selectedFilter));
    const unsubInc = DataEvents.subscribe('INCOME_CHANGED', () => fetchMetrics(selectedFilter));
    return () => {
      unsubExp();
      unsubInc();
    };
  }, [fetchMetrics, selectedFilter]);

  const handleSelectFilter = (filter: DashboardFilter) => {
    setSelectedFilter(filter);
    setShowDropdown(false);
    fetchMetrics(filter);
    if (onFilterChange) {
      onFilterChange(filter);
    }
  };

  return (
    <View
      style={[
        styles.cashflowCard,
        {
          backgroundColor: isDark ? '#121626' : '#FFFFFF',
          borderColor: isDark ? '#232A42' : '#E2E8F0',
          shadowOpacity: isDark ? 0.25 : 0.06,
        },
      ]}
    >
      {/* Top Header Row */}
      <View style={styles.cardHeaderRow}>
        {/* Left: Wallet Icon Badge + Balance Texts */}
        <View style={styles.walletAndInfo}>
          <View
            style={[
              styles.walletBadge,
              { backgroundColor: isDark ? '#384370' : '#EEF2FF' },
            ]}
          >
            <View
              style={[
                styles.walletOuter,
                { borderColor: isDark ? '#FFFFFF' : '#4F46E5' },
              ]}
            >
              <View
                style={[
                  styles.walletFlap,
                  {
                    borderColor: isDark ? '#FFFFFF' : '#4F46E5',
                    backgroundColor: isDark ? '#384370' : '#EEF2FF',
                  },
                ]}
              >
                <View
                  style={[
                    styles.walletClaspDot,
                    { backgroundColor: isDark ? '#FFFFFF' : '#4F46E5' },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.balanceTexts}>
            <Text
              style={[
                styles.balanceTag,
                { color: isDark ? '#8F9BB3' : '#64748B' },
              ]}
            >
              NET CASHFLOW BALANCE
            </Text>
            <Text
              style={[
                styles.balanceBigNumber,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrencyFromCents(metrics.netBalanceCents, currency)}
            </Text>
            <Text
              style={[
                styles.balanceSubNotice,
                { color: isDark ? '#8F9BB3' : '#64748B' },
              ]}
            >
              {metrics.netBalanceCents < 0
                ? "You've spent more than earned"
                : metrics.netBalanceCents > 0
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
            style={[
              styles.filterPill,
              {
                backgroundColor: isDark ? '#20273F' : '#F1F5F9',
                borderColor: isDark ? '#2D385A' : '#E2E8F0',
                borderWidth: isDark ? 0 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${FILTER_LABELS[selectedFilter]}`}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              {FILTER_LABELS[selectedFilter]}
            </Text>
            <Text
              style={[
                styles.filterPillChevron,
                { color: isDark ? '#8F9BB3' : '#64748B' },
              ]}
            >
              {showDropdown ? '▴' : '▾'}
            </Text>
          </TouchableOpacity>

          {/* Fast Floating Dropdown Menu */}
          {showDropdown && (
            <>
              <TouchableOpacity
                style={styles.dropdownBackdrop}
                activeOpacity={1}
                onPress={() => setShowDropdown(false)}
              />
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    backgroundColor: isDark ? '#1B2138' : '#FFFFFF',
                    borderColor: isDark ? '#2D385A' : '#E2E8F0',
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
                      activeOpacity={0.7}
                      style={[
                        styles.dropdownItem,
                        isSelected && {
                          backgroundColor: isDark
                            ? 'rgba(99, 102, 241, 0.22)'
                            : 'rgba(99, 102, 241, 0.12)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          isSelected
                            ? { color: isDark ? '#FFFFFF' : '#4F46E5', fontWeight: '700' }
                            : { color: isDark ? '#C5CEE0' : '#475569', fontWeight: '500' },
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
      <View
        style={[
          styles.cardDivider,
          { backgroundColor: isDark ? '#232A42' : '#E2E8F0' },
        ]}
      />

      {/* Bottom Metrics Row */}
      <View style={styles.cardMetricsRow}>
        {/* Total Income Item */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onNavigateIncome}
          style={styles.metricHalf}
          accessibilityRole="button"
          accessibilityLabel="View income streams"
        >
          <View style={styles.incomeArrowBadge}>
            <Text style={styles.incomeArrowText}>↑</Text>
          </View>
          <View style={styles.metricTextsColumn}>
            <Text
              style={[
                styles.metricLabelText,
                { color: isDark ? '#8F9BB3' : '#64748B' },
              ]}
            >
              Total Income
            </Text>
            <Text style={styles.incomeValueText}>
              {formatCurrencyFromCents(metrics.totalIncomeCents, currency)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Vertical Divider */}
        <View
          style={[
            styles.metricVerticalDivider,
            { backgroundColor: isDark ? '#232A42' : '#E2E8F0' },
          ]}
        />

        {/* Total Expenses Item */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onNavigateExpenses}
          style={[styles.metricHalf, styles.expenseHalf]}
          accessibilityRole="button"
          accessibilityLabel="View expense items"
        >
          <View style={styles.expenseArrowBadge}>
            <Text style={styles.expenseArrowText}>↓</Text>
          </View>
          <View style={styles.metricTextsColumn}>
            <Text
              style={[
                styles.metricLabelText,
                { color: isDark ? '#8F9BB3' : '#64748B' },
              ]}
            >
              Total Expenses
            </Text>
            <Text style={styles.expenseValueText}>
              {formatCurrencyFromCents(metrics.totalExpensesCents, currency)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

CashflowOverviewCard.displayName = 'CashflowOverviewCard';

const styles = StyleSheet.create({
  cashflowCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
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
    borderRightWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletClaspDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
  },
  balanceTexts: {
    flex: 1,
  },
  balanceTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  balanceBigNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 2,
  },
  balanceSubNotice: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterPillWrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillChevron: {
    fontSize: 10,
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
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    zIndex: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
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
  dropdownItemText: {
    fontSize: 12,
  },
  dropdownItemCheck: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366F1',
  },
  cardDivider: {
    height: 1,
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
  },
});
