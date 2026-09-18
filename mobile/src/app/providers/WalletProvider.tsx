import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletModel } from '../../domain/models';
import {
  listWalletsUseCase,
  createWalletUseCase,
  renameWalletUseCase,
  deleteWalletUseCase,
  ensureDefaultWalletUseCase,
} from '../../domain/usecases/walletUseCases';
import { useAuth } from './AuthProvider';
import { DataEvents } from '../../database/sqlite/DataEvents';

const ACTIVE_WALLET_KEY_PREFIX = '@wallet/active_wallet_';

export interface WalletContextType {
  wallets: WalletModel[];
  activeWallet: WalletModel | null;
  activeWalletId: string | null;
  isLoading: boolean;
  setActiveWalletId: (id: string) => Promise<void>;
  createWallet: (name: string) => Promise<WalletModel>;
  renameWallet: (id: string, name: string) => Promise<WalletModel>;
  deleteWallet: (id: string) => Promise<void>;
  refreshWallets: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  wallets: [],
  activeWallet: null,
  activeWalletId: null,
  isLoading: true,
  setActiveWalletId: async () => {},
  createWallet: async () => ({} as WalletModel),
  renameWallet: async () => ({} as WalletModel),
  deleteWallet: async () => {},
  refreshWallets: async () => {},
});

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<WalletModel[]>([]);
  const [activeWalletId, setActiveWalletIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRefreshingRef = useRef(false);

  const activeWallet = wallets.find((w) => w.id === activeWalletId) || wallets[0] || null;

  const refreshWallets = useCallback(async () => {
    if (!user?.id) {
      setWallets([]);
      setActiveWalletIdState(null);
      setIsLoading(false);
      return;
    }

    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;

    try {
      // 1. Ensure user has at least default 'Wallet 1'
      await ensureDefaultWalletUseCase(user.id);

      // 2. Fetch all wallets
      const all = await listWalletsUseCase();
      setWallets(all);

      // 3. Resolve active wallet
      const storageKey = `${ACTIVE_WALLET_KEY_PREFIX}${user.id}`;
      const savedActiveId = await AsyncStorage.getItem(storageKey);

      if (savedActiveId && all.some((w) => w.id === savedActiveId)) {
        setActiveWalletIdState(savedActiveId);
      } else {
        const defaultWallet = all.find((w) => w.isDefault) || all[0];
        if (defaultWallet) {
          setActiveWalletIdState(defaultWallet.id);
          await AsyncStorage.setItem(storageKey, defaultWallet.id);
        }
      }
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    refreshWallets();
  }, [refreshWallets]);

  // Reactive subscription: auto-refresh wallet balances and lists
  useEffect(() => {
    const unsubWallets = DataEvents.subscribe('WALLETS_CHANGED', () => {
      refreshWallets();
    });
    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', () => {
      refreshWallets();
    });
    const unsubInc = DataEvents.subscribe('INCOME_CHANGED', () => {
      refreshWallets();
    });

    return () => {
      unsubWallets();
      unsubExp();
      unsubInc();
    };
  }, [refreshWallets]);

  const setActiveWalletId = async (id: string) => {
    setActiveWalletIdState(id);
    if (user?.id) {
      const storageKey = `${ACTIVE_WALLET_KEY_PREFIX}${user.id}`;
      await AsyncStorage.setItem(storageKey, id);
    }
  };

  const createWallet = async (name: string): Promise<WalletModel> => {
    const created = await createWalletUseCase(name);
    await refreshWallets();
    return created;
  };

  const renameWallet = async (id: string, name: string): Promise<WalletModel> => {
    const updated = await renameWalletUseCase(id, name);
    await refreshWallets();
    return updated;
  };

  const deleteWallet = async (id: string): Promise<void> => {
    await deleteWalletUseCase(id);
    if (activeWalletId === id) {
      const remaining = wallets.filter((w) => w.id !== id);
      const nextActive = remaining.find((w) => w.isDefault) || remaining[0];
      if (nextActive) {
        await setActiveWalletId(nextActive.id);
      }
    }
    await refreshWallets();
  };

  return (
    <WalletContext.Provider
      value={{
        wallets,
        activeWallet,
        activeWalletId: activeWallet?.id || null,
        isLoading,
        setActiveWalletId,
        createWallet,
        renameWallet,
        deleteWallet,
        refreshWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
