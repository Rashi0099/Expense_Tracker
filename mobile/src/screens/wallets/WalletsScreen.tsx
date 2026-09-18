import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { CurrencyText } from '../../components/common/CurrencyText';
import { useWallet } from '../../app/providers/WalletProvider';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';
import { IconWallet } from '../../components/common/NavIcons';
import { WalletModel } from '../../domain/models';
import { canDeleteWalletUseCase } from '../../domain/usecases/walletUseCases';

export const WalletsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const {
    wallets,
    activeWallet,
    activeWalletId,
    setActiveWalletId,
    createWallet,
    renameWallet,
    deleteWallet,
  } = useWallet();

  const currency = user?.baseCurrency || 'INR';

  // Add Wallet Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Rename Wallet Modal State
  const [renamingWallet, setRenamingWallet] = useState<WalletModel | null>(null);
  const [editWalletName, setEditWalletName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Handle Add Wallet
  const handleCreateWallet = async () => {
    const trimmed = newWalletName.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Please enter a name for the wallet.');
      return;
    }

    setIsCreating(true);
    try {
      await createWallet(trimmed);
      setNewWalletName('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create wallet.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Open Rename
  const handleOpenRename = (wallet: WalletModel) => {
    setRenamingWallet(wallet);
    setEditWalletName(wallet.name);
  };

  // Handle Save Rename
  const handleSaveRename = async () => {
    if (!renamingWallet) return;
    const trimmed = editWalletName.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Please enter a name for the wallet.');
      return;
    }

    setIsRenaming(true);
    try {
      await renameWallet(renamingWallet.id, trimmed);
      setRenamingWallet(null);
      setEditWalletName('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to rename wallet.');
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle Safe Delete
  const handleDeleteWallet = async (wallet: WalletModel) => {
    try {
      const safety = await canDeleteWalletUseCase(wallet.id);
      if (!safety.canDelete) {
        Alert.alert(
          'Cannot Delete Wallet',
          safety.reason || 'This wallet cannot be deleted because it is not empty.',
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert(
        'Delete Wallet',
        `Are you sure you want to delete "${wallet.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteWallet(wallet.id);
              } catch (err: any) {
                Alert.alert('Error', err?.message || 'Failed to delete wallet.');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not verify wallet deletion safety.');
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backArrow, { color: theme.colors.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Wallets</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Active Wallet Hero Card */}
      {activeWallet && (
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTagRow}>
              <View style={[styles.heroIconWrap, { backgroundColor: isDark ? '#1E293B' : '#E0E7FF' }]}>
                <IconWallet color={theme.colors.primary} size={18} />
              </View>
              <Text style={[styles.heroSubLabel, { color: theme.colors.textMuted }]}>
                CURRENT ACTIVE WALLET
              </Text>
            </View>
            {activeWallet.isDefault && (
              <View style={[styles.defaultBadge, { backgroundColor: theme.colors.surfaceSubtle }]}>
                <Text style={[styles.defaultBadgeText, { color: theme.colors.textSecondary }]}>Default</Text>
              </View>
            )}
          </View>
          <Text style={[styles.heroWalletName, { color: theme.colors.textPrimary }]}>
            {activeWallet.name}
          </Text>
          <View style={styles.heroBalanceRow}>
            <Text style={[styles.heroBalanceLabel, { color: theme.colors.textSecondary }]}>Balance</Text>
            <Text
              style={[
                styles.heroBalanceValue,
                {
                  color:
                    (activeWallet.balanceCents || 0) >= 0
                      ? theme.colors.textPrimary
                      : theme.colors.expense,
                },
              ]}
            >
              <CurrencyText amountCents={activeWallet.balanceCents || 0} currency={currency} />
            </Text>
          </View>
        </Card>
      )}

      {/* Section: All Wallets */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          ALL WALLETS ({wallets.length})
        </Text>
      </View>

      {wallets.map((wallet) => {
        const isCurrent = wallet.id === activeWalletId;
        const balance = wallet.balanceCents || 0;

        return (
          <Card
            key={wallet.id}
            style={[
              styles.walletCard,
              isCurrent && {
                borderColor: theme.colors.primary,
                borderWidth: 1.5,
              },
            ]}
          >
            <View style={styles.walletCardTop}>
              <View style={styles.walletNameRow}>
                <Text
                  style={[
                    styles.walletCheck,
                    { color: isCurrent ? theme.colors.primary : 'transparent' },
                  ]}
                >
                  ✓
                </Text>
                <View>
                  <View style={styles.walletTitleInline}>
                    <Text style={[styles.walletTitle, { color: theme.colors.textPrimary }]}>
                      {wallet.name}
                    </Text>
                    {wallet.isDefault && (
                      <View style={[styles.inlineDefaultBadge, { backgroundColor: theme.colors.surfaceSubtle }]}>
                        <Text style={[styles.inlineDefaultBadgeText, { color: theme.colors.textMuted }]}>
                          Default
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.walletCardBalance, { color: theme.colors.textSecondary }]}>
                    Balance: <CurrencyText amountCents={balance} currency={currency} />
                  </Text>
                </View>
              </View>

              {/* Status Badge or Switch Button */}
              {isCurrent ? (
                <View style={[styles.activeStatusBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF' }]}>
                  <Text style={[styles.activeStatusText, { color: theme.colors.primary }]}>Active</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.switchBtn, { borderColor: theme.colors.surfaceBorder }]}
                  onPress={() => setActiveWalletId(wallet.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.switchBtnText, { color: theme.colors.primary }]}>Switch</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Actions Row */}
            <View style={[styles.actionsDivider, { backgroundColor: theme.colors.surfaceBorder }]} />
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleOpenRename(wallet)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionIcon}>✏️</Text>
                <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>Rename</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteWallet(wallet)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionIcon}>🗑️</Text>
                <Text style={[styles.actionText, { color: theme.colors.expense }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      {/* Add Wallet Button */}
      <View style={styles.addBtnContainer}>
        <Button
          label="+ Add New Wallet"
          onPress={() => setIsAddModalOpen(true)}
          variant="primary"
          size="lg"
        />
      </View>

      {/* Add Wallet Modal */}
      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              Create New Wallet
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Give your wallet a recognizable name (e.g. Cash, HDFC Bank, Savings).
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.surfaceBorder,
                  color: theme.colors.textPrimary,
                },
              ]}
              placeholder="e.g. Cash or Bank"
              placeholderTextColor={theme.colors.textMuted}
              value={newWalletName}
              onChangeText={setNewWalletName}
              autoFocus
              maxLength={30}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                label="Cancel"
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                onPress={() => {
                  setNewWalletName('');
                  setIsAddModalOpen(false);
                }}
              />
              <Button
                label="Create"
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                isLoading={isCreating}
                onPress={handleCreateWallet}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Wallet Modal */}
      <Modal
        visible={!!renamingWallet}
        transparent
        animationType="fade"
        onRequestClose={() => setRenamingWallet(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              Rename Wallet
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Enter a new name for "{renamingWallet?.name}".
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.surfaceBorder,
                  color: theme.colors.textPrimary,
                },
              ]}
              placeholder="New wallet name"
              placeholderTextColor={theme.colors.textMuted}
              value={editWalletName}
              onChangeText={setEditWalletName}
              autoFocus
              maxLength={30}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                label="Cancel"
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                onPress={() => setRenamingWallet(null)}
              />
              <Button
                label="Save"
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                isLoading={isRenaming}
                onPress={handleSaveRename}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRightPlaceholder: {
    width: 36,
  },
  heroCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroWalletName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  heroBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  heroBalanceLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  heroBalanceValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  walletCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  walletCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  walletCheck: {
    fontSize: 16,
    fontWeight: '800',
    width: 18,
    textAlign: 'center',
  },
  walletTitleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inlineDefaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inlineDefaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  walletCardBalance: {
    fontSize: 13,
    marginTop: 2,
  },
  activeStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  activeStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  switchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionsDivider: {
    height: 1,
    marginVertical: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  actionIcon: {
    fontSize: 13,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addBtnContainer: {
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 18,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
