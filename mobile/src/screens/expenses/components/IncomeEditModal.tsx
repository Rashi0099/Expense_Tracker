import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { IncomeModel, CategoryModel } from '../../../domain/models';
import { MoneyInput } from '../../../components/forms/MoneyInput';
import { TextInput } from '../../../components/forms/TextInput';
import { Button } from '../../../components/common/Button';
import {
  createIncomeUseCase,
  updateIncomeUseCase,
  deleteIncomeUseCase,
} from '../../../domain/usecases/incomeUseCases';
import { listCategoriesUseCase } from '../../../domain/usecases/categoryUseCases';
import { dollarsToCents, centsToDollars } from '../../../utils/money';
import { getTodayDateString } from '../../../utils/date';
import { useTheme } from '../../../theme/useTheme';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useWallet } from '../../../app/providers/WalletProvider';

interface IncomeEditModalProps {
  visible: boolean;
  income: IncomeModel | null; // null => Record New Income
  onClose: () => void;
  onSuccess: () => void;
}

export const IncomeEditModal: React.FC<IncomeEditModalProps> = ({
  visible,
  income,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { activeWalletId, wallets } = useWallet();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await listCategoriesUseCase('INCOME');
        setCategories(cats);
        if (cats.length > 0 && !categoryId) {
          setCategoryId(cats[0].id);
        }
      } catch {
        // Handled
      }
    }
    if (visible) {
      loadCategories();
    }
  }, [visible, categoryId]);

  useEffect(() => {
    if (income) {
      setAmount(centsToDollars(income.amountCents));
      setCategoryId(income.categoryId);
      setSelectedWalletId(income.walletId || activeWalletId || (wallets[0]?.id ?? ''));
      setSource(income.source);
      setNote(income.note || '');
      setTransactionDate(income.transactionDate);
      setError(null);
    } else {
      setAmount('');
      setSelectedWalletId(activeWalletId || (wallets[0]?.id ?? ''));
      setSource('');
      setNote('');
      setTransactionDate(getTodayDateString());
      setError(null);
    }
  }, [income, visible, activeWalletId, wallets]);

  if (!visible) return null;

  const handleSave = async () => {
    const cents = dollarsToCents(amount);
    if (cents <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!categoryId) {
      setError('Please select an income category.');
      return;
    }
    if (!source.trim()) {
      setError('Source (employer/client) is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (income) {
        await updateIncomeUseCase(income.id, {
          categoryId,
          walletId: selectedWalletId || undefined,
          amountCents: cents,
          source: source.trim(),
          note: note.trim() || undefined,
          transactionDate,
        });
      } else {
        await createIncomeUseCase({
          categoryId,
          walletId: selectedWalletId || activeWalletId || undefined,
          amountCents: cents,
          currency: user?.baseCurrency || 'USD',
          source: source.trim(),
          note: note.trim() || undefined,
          transactionDate: transactionDate || getTodayDateString(),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save income record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!income) return;
    Alert.alert(
      'Delete Income',
      `Are you sure you want to delete this income from ${income.source}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteIncomeUseCase(income.id);
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete income');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {income ? 'Edit Income' : 'Record Income'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: theme.colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Money Input */}
            <MoneyInput
              value={amount}
              onChangeValue={(val) => {
                setAmount(val);
                if (error) setError(null);
              }}
              currency={user?.baseCurrency || 'USD'}
              error={error || undefined}
            />

            {/* Wallet Selector */}
            {wallets.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                  Wallet
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {wallets.map((w) => {
                    const isSelected = (selectedWalletId || activeWalletId) === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        onPress={() => setSelectedWalletId(w.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.income
                              : theme.colors.surfaceSubtle,
                            borderColor: isSelected
                              ? theme.colors.income
                              : theme.colors.surfaceBorder,
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

            {/* Category Selector */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Income Category
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {categories.map((cat) => {
                const isSelected = cat.id === categoryId;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategoryId(cat.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.income
                          : theme.colors.surfaceSubtle,
                        borderColor: isSelected
                          ? theme.colors.income
                          : theme.colors.surfaceBorder,
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

            {/* Source / Client */}
            <TextInput
              label="Source / Client"
              value={source}
              onChangeText={setSource}
              placeholder="e.g. Salary, Freelance, Dividend"
            />

            {/* Date */}
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
              placeholder="e.g. Bonus, Advance payment"
            />

            {/* Buttons */}
            <View style={styles.actions}>
              <Button
                label={income ? 'Save Changes' : 'Record Income'}
                onPress={handleSave}
                isLoading={isSaving}
                size="md"
                style={styles.saveBtn}
              />
              {income && (
                <Button
                  label="Delete Income"
                  variant="danger"
                  onPress={handleDelete}
                  size="md"
                  style={styles.deleteBtn}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    marginTop: 12,
    gap: 10,
  },
  saveBtn: {
    width: '100%',
  },
  deleteBtn: {
    width: '100%',
  },
});
