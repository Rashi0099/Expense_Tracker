import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { CurrencyText } from '../../components/common/CurrencyText';
import { EmptyState } from '../../components/common/EmptyState';
import { TextInput } from '../../components/forms/TextInput';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Button } from '../../components/common/Button';
import { RecurringExpenseModel, CategoryModel, RecurringFrequency } from '../../domain/models';
import {
  listRecurringUseCase,
  createRecurringUseCase,
  toggleRecurringActiveUseCase,
  deleteRecurringUseCase,
} from '../../domain/usecases/recurringUseCases';
import { listCategoriesUseCase } from '../../domain/usecases/categoryUseCases';
import { dollarsToCents } from '../../utils/money';
import { formatDisplayDate, getTodayDateString } from '../../utils/date';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';
import { DataEvents } from '../../database/sqlite/DataEvents';

const FREQUENCIES: RecurringFrequency[] = ['MONTHLY', 'WEEKLY', 'YEARLY', 'DAILY'];

export const RecurringExpensesScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [recurringList, setRecurringList] = useState<RecurringExpenseModel[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [nextDueDate, setNextDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecurring = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listRecurringUseCase();
      setRecurringList(list);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadCats() {
      try {
        const cats = await listCategoriesUseCase('EXPENSE');
        setCategories(cats);
        if (cats.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(cats[0].id);
        }
      } catch {
        // Handled
      }
    }
    loadCats();
  }, [selectedCategoryId]);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  useEffect(() => {
    const unsub = DataEvents.subscribe('RECURRING_CHANGED', () => {
      loadRecurring();
    });
    return unsub;
  }, [loadRecurring]);

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      await toggleRecurringActiveUseCase(id, !currentState);
      loadRecurring();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to toggle status');
    }
  };

  const handleCreateRecurring = async () => {
    const cents = dollarsToCents(amount);
    if (!title.trim()) {
      setError('Please enter a title for the recurring expense.');
      return;
    }
    if (cents <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!selectedCategoryId) {
      setError('Please select a category.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createRecurringUseCase({
        title: title.trim(),
        categoryId: selectedCategoryId,
        amountCents: cents,
        frequency,
        currency: user?.baseCurrency || 'USD',
        startDate: getTodayDateString(),
        nextDueDate: nextDueDate || getTodayDateString(),
      });

      setTitle('');
      setAmount('');
      setIsModalOpen(false);
      loadRecurring();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save recurring bill');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string, itemTitle: string) => {
    Alert.alert(
      'Delete Recurring Bill',
      `Are you sure you want to delete "${itemTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRecurringUseCase(id);
            loadRecurring();
          },
        },
      ]
    );
  };

  return (
    <Screen style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Recurring Bills</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Subscriptions & scheduled commitments
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setTitle('');
            setAmount('');
            setNextDueDate(getTodayDateString());
            setError(null);
            setIsModalOpen(true);
          }}
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.addButtonText}>+ Add Bill</Text>
        </TouchableOpacity>
      </View>

      {/* Recurring List */}
      <FlatList
        data={recurringList}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={loadRecurring}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="🔁"
              title="No Recurring Bills"
              description="Keep track of Netflix, rent, gym memberships, and subscriptions offline."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onLongPress={() => handleDelete(item.id, item.title)}>
            <Card style={[styles.card, { opacity: item.isActive ? 1 : 0.6 }]}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.surfaceSubtle }]}>
                  <Text style={styles.icon}>{item.categoryIcon || '🔁'}</Text>
                </View>
                <View>
                  <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                    {item.frequency} • Due: {formatDisplayDate(item.nextDueDate)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <CurrencyText
                  amountCents={item.amountCents}
                  currency={item.currency}
                  style={styles.amount}
                />
                <Switch
                  value={item.isActive}
                  onValueChange={() => handleToggleActive(item.id, item.isActive)}
                  trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceSubtle }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      {/* Add Recurring Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                Add Recurring Bill
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <Text style={[styles.closeBtnText, { color: theme.colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              <MoneyInput
                value={amount}
                onChangeValue={(val) => {
                  setAmount(val);
                  if (error) setError(null);
                }}
                currency={user?.baseCurrency || 'USD'}
                error={error || undefined}
              />

              <TextInput
                label="Subscription / Bill Title"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Netflix, Spotify, Gym, Rent"
              />

              {/* Frequency Selector */}
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Frequency</Text>
              <View style={styles.frequencyRow}>
                {FREQUENCIES.map((freq) => {
                  const isSelected = frequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      onPress={() => setFrequency(freq)}
                      style={[
                        styles.freqBtn,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.freqBtnText,
                          { color: isSelected ? '#FFFFFF' : theme.colors.textSecondary },
                        ]}
                      >
                        {freq}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Category Picker */}
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {categories.map((cat) => {
                  const isSelected = cat.id === selectedCategoryId;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategoryId(cat.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.surfaceBorder,
                        },
                      ]}
                    >
                      <Text style={styles.chipIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TextInput
                label="Next Due Date (YYYY-MM-DD)"
                value={nextDueDate}
                onChangeText={setNextDueDate}
                placeholder="YYYY-MM-DD"
              />

              <Button
                label="Save Recurring Bill"
                onPress={handleCreateRecurring}
                isLoading={isSaving}
                size="md"
                style={styles.saveBtn}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 8,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: 15,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollBody: {
    paddingBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  freqBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 20,
    width: '100%',
  },
});
