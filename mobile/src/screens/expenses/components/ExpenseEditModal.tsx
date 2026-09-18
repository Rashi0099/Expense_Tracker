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
import { ExpenseModel, CategoryModel, PaymentMethod } from '../../../domain/models';
import { MoneyInput } from '../../../components/forms/MoneyInput';
import { TextInput } from '../../../components/forms/TextInput';
import { Button } from '../../../components/common/Button';
import { updateExpenseUseCase, deleteExpenseUseCase } from '../../../domain/usecases/expenseUseCases';
import { listCategoriesUseCase } from '../../../domain/usecases/categoryUseCases';
import { dollarsToCents, centsToDollars } from '../../../utils/money';
import { useTheme } from '../../../theme/useTheme';
import { useWallet } from '../../../app/providers/WalletProvider';
import { PAYMENT_METHODS } from '../../../app/config/constants';

interface ExpenseEditModalProps {
  visible: boolean;
  expense: ExpenseModel | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpenseEditModal: React.FC<ExpenseEditModalProps> = ({
  visible,
  expense,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const { activeWalletId, wallets } = useWallet();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDIT_CARD');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await listCategoriesUseCase('EXPENSE');
        setCategories(cats);
      } catch {
        // Handled
      }
    }
    if (visible) {
      loadCategories();
    }
  }, [visible]);

  useEffect(() => {
    if (expense) {
      setAmount(centsToDollars(expense.amountCents));
      setCategoryId(expense.categoryId);
      setSelectedWalletId(expense.walletId || activeWalletId || (wallets[0]?.id ?? ''));
      setPaymentMethod(expense.paymentMethod);
      setPayee(expense.payee || '');
      setNote(expense.note || '');
      setTransactionDate(expense.transactionDate);
      setError(null);
    }
  }, [expense, activeWalletId, wallets]);

  if (!expense) return null;

  const handleSave = async () => {
    const cents = dollarsToCents(amount);
    if (cents <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateExpenseUseCase(expense.id, {
        categoryId,
        walletId: selectedWalletId || undefined,
        amountCents: cents,
        paymentMethod,
        payee: payee.trim() || undefined,
        note: note.trim() || undefined,
        transactionDate,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update expense');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete this expense?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpenseUseCase(expense.id);
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete expense');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Edit Expense
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: theme.colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Amount input */}
            <MoneyInput
              value={amount}
              onChangeValue={(val) => {
                setAmount(val);
                if (error) setError(null);
              }}
              currency={expense.currency}
              error={error || undefined}
            />

            {/* Wallet Selector */}
            {wallets.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Wallet</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {wallets.map((w) => {
                    const isSelected = (selectedWalletId || activeWalletId) === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        onPress={() => setSelectedWalletId(w.id)}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                            borderColor: isSelected ? theme.colors.primary : theme.colors.surfaceBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: isSelected ? theme.colors.textInverse : theme.colors.textPrimary,
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

            {/* Category selection */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {categories.map((cat) => {
                const isSelected = cat.id === categoryId;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategoryId(cat.id)}
                    style={[
                      styles.categoryChip,
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
                        { color: isSelected ? theme.colors.textInverse : theme.colors.textPrimary },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Payment Method selection */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Payment Method</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {PAYMENT_METHODS.map((method) => {
                const isSelected = method.value === paymentMethod;
                return (
                  <TouchableOpacity
                    key={method.value}
                    onPress={() => setPaymentMethod(method.value as PaymentMethod)}
                    style={[
                      styles.methodChip,
                      {
                        backgroundColor: isSelected ? theme.colors.primaryLight : theme.colors.surfaceSubtle,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Payee and Note */}
            <TextInput
              label="Payee / Merchant"
              value={payee}
              onChangeText={setPayee}
              placeholder="e.g. Starbucks, Uber"
            />

            <TextInput
              label="Date (YYYY-MM-DD)"
              value={transactionDate}
              onChangeText={setTransactionDate}
              placeholder="YYYY-MM-DD"
            />

            <TextInput
              label="Note (Optional)"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Lunch with team"
            />

            {/* Buttons */}
            <View style={styles.actionButtons}>
              <Button
                label="Save Changes"
                onPress={handleSave}
                isLoading={isSaving}
                size="md"
                style={styles.saveBtn}
              />
              <Button
                label="Delete Expense"
                variant="danger"
                onPress={handleDelete}
                size="md"
                style={styles.deleteBtn}
              />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
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
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
  },
  categoryChip: {
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
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
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
