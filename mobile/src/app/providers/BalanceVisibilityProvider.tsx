import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BALANCE_HIDDEN_STORAGE_KEY = '@settings/balance_hidden';

interface BalanceVisibilityContextType {
  isBalanceHidden: boolean;
  toggleBalanceHidden: () => void;
  setBalanceHidden: (hidden: boolean) => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibilityContextType>({
  isBalanceHidden: false,
  toggleBalanceHidden: () => {},
  setBalanceHidden: () => {},
});

export const BalanceVisibilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isBalanceHidden, setIsBalanceHiddenState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BALANCE_HIDDEN_STORAGE_KEY)
      .then((val) => {
        if (val === '1' || val === 'true') {
          setIsBalanceHiddenState(true);
        }
      })
      .catch(() => {});
  }, []);

  const toggleBalanceHidden = useCallback(() => {
    setIsBalanceHiddenState((prev) => {
      const next = !prev;
      AsyncStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  const setBalanceHidden = useCallback((hidden: boolean) => {
    setIsBalanceHiddenState(hidden);
    AsyncStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, hidden ? '1' : '0').catch(() => {});
  }, []);

  return (
    <BalanceVisibilityContext.Provider
      value={{ isBalanceHidden, toggleBalanceHidden, setBalanceHidden }}
    >
      {children}
    </BalanceVisibilityContext.Provider>
  );
};

export const useBalanceVisibility = (): BalanceVisibilityContextType =>
  useContext(BalanceVisibilityContext);
