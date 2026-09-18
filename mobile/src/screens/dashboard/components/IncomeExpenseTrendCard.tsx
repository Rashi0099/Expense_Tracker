import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../../theme/useTheme';
import { Card } from '../../../components/common/Card';
import { CurrencyText } from '../../../components/common/CurrencyText';
import {
  getSixMonthTrendUseCase,
  MonthTrendData,
} from '../../../domain/usecases/dashboardUseCases';
import { DataEvents } from '../../../database/sqlite/DataEvents';

interface IncomeExpenseTrendCardProps {
  walletId?: string;
  refreshTrigger?: number;
  currency?: string;
}

const MAX_BAR_HEIGHT = 110;
const MIN_BAR_HEIGHT = 6;

export const IncomeExpenseTrendCard: React.FC<IncomeExpenseTrendCardProps> = ({
  walletId,
  refreshTrigger = 0,
  currency = 'INR',
}) => {
  const { theme, isDark } = useTheme();
  const [trends, setTrends] = useState<MonthTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<MonthTrendData | null>(null);

  const loadTrendData = useCallback(async () => {
    try {
      const data = await getSixMonthTrendUseCase(6, walletId);
      setTrends(data);
      // Default selected month to current month (last in array) if available
      if (data.length > 0) {
        setSelectedMonth((prev) => {
          if (!prev) return data[data.length - 1];
          const matched = data.find((d) => d.monthKey === prev.monthKey);
          return matched || data[data.length - 1];
        });
      }
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    loadTrendData();
  }, [loadTrendData, refreshTrigger]);

  // Reactive subscription to data events
  useEffect(() => {
    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', loadTrendData);
    const unsubInc = DataEvents.subscribe('INCOME_CHANGED', loadTrendData);
    const unsubWal = DataEvents.subscribe('WALLETS_CHANGED', loadTrendData);
    return () => {
      unsubExp();
      unsubInc();
      unsubWal();
    };
  }, [loadTrendData]);

  // Calculate maximum value across 6 months for proportional scaling
  const maxCents = Math.max(
    ...trends.map((t) => Math.max(t.incomeCents, t.expenseCents)),
    100 // fallback non-zero so we don't divide by zero
  );

  const incomeColor = '#10B981'; // Emerald Green
  const expenseColor = '#F43F5E'; // Rose / Coral Red

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}>
      {/* Header with Title, Subtitle, and Legend */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Income vs Expenses Trend
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            6-Month historical comparison
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: incomeColor }]} />
            <Text style={[styles.legendLabel, { color: theme.colors.textSecondary }]}>
              Income
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: expenseColor }]} />
            <Text style={[styles.legendLabel, { color: theme.colors.textSecondary }]}>
              Expenses
            </Text>
          </View>
        </View>
      </View>

      {/* Selected Month Detail Strip (when user taps a month) */}
      {selectedMonth && (
        <View
          style={[
            styles.tooltipStrip,
            {
              backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.tooltipMonthLabel, { color: theme.colors.textPrimary }]}>
            {selectedMonth.monthLabel}
          </Text>
          <View style={styles.tooltipMetricsRow}>
            <View style={styles.tooltipMetric}>
              <View style={[styles.microDot, { backgroundColor: incomeColor }]} />
              <CurrencyText
                amountCents={selectedMonth.incomeCents}
                currency={currency}
                style={{ ...styles.tooltipValue, color: incomeColor }}
              />
            </View>
            <Text style={[styles.tooltipDivider, { color: theme.colors.textMuted }]}>•</Text>
            <View style={styles.tooltipMetric}>
              <View style={[styles.microDot, { backgroundColor: expenseColor }]} />
              <CurrencyText
                amountCents={selectedMonth.expenseCents}
                currency={currency}
                style={{ ...styles.tooltipValue, color: expenseColor }}
              />
            </View>
          </View>
        </View>
      )}

      {/* Bar Chart Canvas */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.chartContainer}>
          <View style={styles.barsRow}>
            {trends.map((item) => {
              const isSelected = selectedMonth?.monthKey === item.monthKey;

              // Calculate proportional heights (with min height so baseline pill caps render cleanly)
              const incomeHeight = item.incomeCents > 0
                ? Math.max(MIN_BAR_HEIGHT, Math.round((item.incomeCents / maxCents) * MAX_BAR_HEIGHT))
                : MIN_BAR_HEIGHT;

              const expenseHeight = item.expenseCents > 0
                ? Math.max(MIN_BAR_HEIGHT, Math.round((item.expenseCents / maxCents) * MAX_BAR_HEIGHT))
                : MIN_BAR_HEIGHT;

              return (
                <TouchableOpacity
                  key={item.monthKey}
                  activeOpacity={0.7}
                  onPress={() => setSelectedMonth(item)}
                  style={styles.monthColumn}
                >
                  {/* Bars Pair */}
                  <View style={styles.barPairContainer}>
                    {/* Income Bar (Green) */}
                    <View
                      style={[
                        styles.bar,
                        {
                          height: incomeHeight,
                          backgroundColor: incomeColor,
                          opacity: isSelected ? 1 : 0.85,
                        },
                      ]}
                    />

                    {/* Expense Bar (Red) */}
                    <View
                      style={[
                        styles.bar,
                        {
                          height: expenseHeight,
                          backgroundColor: expenseColor,
                          opacity: isSelected ? 1 : 0.85,
                        },
                      ]}
                    />
                  </View>

                  {/* Month Label */}
                  <Text
                    style={[
                      styles.monthLabel,
                      {
                        color: isSelected ? theme.colors.primary : theme.colors.textMuted,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {item.monthLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  titleCol: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tooltipStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  tooltipMonthLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tooltipMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  microDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipDivider: {
    fontSize: 10,
  },
  loadingBox: {
    height: MAX_BAR_HEIGHT + 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContainer: {
    paddingTop: 8,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: MAX_BAR_HEIGHT + 30,
  },
  monthColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barPairContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
    height: MAX_BAR_HEIGHT,
  },
  bar: {
    width: 11,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  monthLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
