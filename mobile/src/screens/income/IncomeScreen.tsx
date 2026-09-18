import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { CurrencyText } from '../../components/common/CurrencyText';
import { EmptyState } from '../../components/common/EmptyState';
import { TextInput } from '../../components/forms/TextInput';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Button } from '../../components/common/Button';
import { IncomeModel, CategoryModel } from '../../domain/models';
import {
  listIncomeUseCase,
  createIncomeUseCase,
  updateIncomeUseCase,
  deleteIncomeUseCase,
  getTotalIncomeCentsUseCase,
} from '../../domain/usecases/incomeUseCases';
import { listCategoriesUseCase } from '../../domain/usecases/categoryUseCases';
import { dollarsToCents, centsToDollars } from '../../utils/money';
import { formatDisplayDate, getTodayDateString } from '../../utils/date';
import { useAuth } from '../../app/providers/AuthProvider';
import { useWallet } from '../../app/providers/WalletProvider';
import { useTheme } from '../../theme/useTheme';
import { DataEvents } from '../../database/sqlite/DataEvents';

export const IncomeScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { activeWalletId, wallets } = useWallet();

  const [incomeList, setIncomeList] = useState<IncomeModel[]>([]);
  const [totalIncomeCents, setTotalIncomeCents] = useState(0);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IncomeModel | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load categories
  useEffect(() => {
    async function loadCats() {
      try {
        const cats = await listCategoriesUseCase('INCOME');
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

  // Load income data from SQLite
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, total] = await Promise.all([
        listIncomeUseCase({ search: search.trim() || undefined }),
        getTotalIncomeCentsUseCase(),
      ]);
      setIncomeList(list);
      setTotalIncomeCents(total);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to reactive data events
  useEffect(() => {
    const unsubIncome = DataEvents.subscribe('INCOME_CHANGED', () => {
      loadData();
    });
    const unsubWallets = DataEvents.subscribe('WALLETS_CHANGED', () => {
      loadData();
    });
    return () => {
      unsubIncome();
      unsubWallets();
    };
  }, [loadData]);

  const openAddModal = () => {
    setEditingItem(null);
    setAmount('');
    setSource('');
    setNote('');
    setTransactionDate(getTodayDateString());
    setSelectedWalletId(activeWalletId || (wallets[0]?.id ?? ''));
    if (categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: IncomeModel) => {
    setEditingItem(item);
    setAmount(centsToDollars(item.amountCents));
    setSelectedCategoryId(item.categoryId);
    setSelectedWalletId(item.walletId || activeWalletId || (wallets[0]?.id ?? ''));
    setSource(item.source);
    setNote(item.note || '');
    setTransactionDate(item.transactionDate);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const cents = dollarsToCents(amount);
    if (cents <= 0) {
      setFormError('Please enter an amount greater than zero.');
      return;
    }
    if (!selectedCategoryId) {
      setFormError('Please select an income category.');
      return;
    }
    if (!source.trim()) {
      setFormError('Source (employer/client) is required.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingItem) {
        await updateIncomeUseCase(editingItem.id, {
          categoryId: selectedCategoryId,
          walletId: selectedWalletId || undefined,
          amountCents: cents,
          source: source.trim(),
          note: note.trim() || undefined,
          transactionDate,
        });
      } else {
        await createIncomeUseCase({
          categoryId: selectedCategoryId,
          walletId: selectedWalletId || activeWalletId || undefined,
          amountCents: cents,
          currency: user?.baseCurrency || 'USD',
          source: source.trim(),
          note: note.trim() || undefined,
          transactionDate: transactionDate || getTodayDateString(),
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save income record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string, sourceName: string) => {
    Alert.alert(
      'Delete Income',
      `Are you sure you want to delete income from ${sourceName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteIncomeUseCase(id);
            if (isModalOpen) setIsModalOpen(false);
            loadData();
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
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Income Streams</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Total: <CurrencyText amountCents={totalIncomeCents} type="income" showSign />
          </Text>
        </View>
        <TouchableOpacity
          onPress={openAddModal}
          style={[styles.addButton, { backgroundColor: theme.colors.income }]}
        >
          <Text style={styles.addButtonText}>+ Add Income</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <TextInput
        placeholder="Search source or notes..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />

      {/* Income List */}
      <FlatList
        data={incomeList}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={loadData}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title={search ? 'No matching income' : 'No income recorded yet'}
              description={
                search
                  ? `No income matches "${search}".`
                  : 'Track your salary, freelance, or investment returns offline.'
              }
            />
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openEditModal(item)}
            onLongPress={() => handleDelete(item.id, item.source)}
          >
            <Card style={styles.card}>
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: item.categoryColor
                        ? `${item.categoryColor}25`
                        : `${theme.colors.income}25`,
                    },
                  ]}
                >
                  <Text style={styles.icon}>{item.categoryIcon || '💼'}</Text>
                </View>
                <View>
                  <Text style={[styles.sourceText, { color: theme.colors.textPrimary }]}>
                    {item.source}
                  </Text>
                  <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                    {formatDisplayDate(item.transactionDate)} • {item.categoryName || 'Income'}{item.walletName ? ` • ${item.walletName}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <CurrencyText
                  amountCents={item.amountCents}
                  currency={item.currency}
                  type="income"
                  showSign
                  style={styles.amount}
                />
                {item.syncStatus === 'PENDING' && (
                  <Text style={[styles.syncBadge, { color: theme.colors.warning }]}>• Offline</Text>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      {/* Add / Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                {editingItem ? 'Edit Income' : 'Record Income'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <Text style={[styles.closeBtnText, { color: theme.colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {/* Money Input */}
              <MoneyInput
                value={amount}
                onChangeValue={(val) => {
                  setAmount(val);
                  if (formError) setFormError(null);
                }}
                currency={user?.baseCurrency || 'USD'}
                error={formError || undefined}
              />

              {/* Wallet selector */}
              {wallets.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                    Wallet
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {wallets.map((w) => {
                      const isSelected = (selectedWalletId || activeWalletId) === w.id;
                      return (
                        <TouchableOpacity
                          key={w.id}
                          onPress={() => setSelectedWalletId(w.id)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isSelected ? theme.colors.income : theme.colors.surfaceSubtle,
                              borderColor: isSelected ? theme.colors.income : theme.colors.surfaceBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isSelected ? '#FFFFFF' : theme.colors.textPrimary,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {isSelected ? '✓ ' : ''}{w.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Category selector */}
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Income Category
              </Text>
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
                          backgroundColor: isSelected ? theme.colors.income : theme.colors.surfaceSubtle,
                          borderColor: isSelected ? theme.colors.income : theme.colors.surfaceBorder,
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

              {/* Source (employer / client) */}
              <TextInput
                label="Source / Client"
                value={source}
                onChangeText={setSource}
                placeholder="e.g. Acme Corp, Upwork, Dividend"
              />

              {/* Transaction Date */}
              <TextInput
                label="Date (YYYY-MM-DD)"
                value={transactionDate}
                onChangeText={setTransactionDate}
                placeholder="YYYY-MM-DD"
              />

              {/* Note */}
              <TextInput
                label="Note (Optional)"
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Monthly salary"
              />

              {/* Actions */}
              <View style={styles.modalActions}>
                <Button
                  label={editingItem ? 'Save Changes' : 'Record Income'}
                  onPress={handleSave}
                  isLoading={isSaving}
                  size="md"
                  style={styles.saveBtn}
                />
                {editingItem && (
                  <Button
                    label="Delete Income"
                    variant="danger"
                    onPress={() => handleDelete(editingItem.id, editingItem.source)}
                    size="md"
                    style={styles.deleteBtn}
                  />
                )}
              </View>
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
    fontSize: 13,
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
  searchInput: {
    marginVertical: 10,
  },
  listContent: {
    paddingBottom: 24,
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
  sourceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
  },
  syncBadge: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
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
  modalActions: {
    marginTop: 20,
    gap: 10,
  },
  saveBtn: {
    width: '100%',
  },
  deleteBtn: {
    width: '100%',
  },
});
