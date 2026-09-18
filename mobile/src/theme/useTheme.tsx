import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, lightTheme, darkTheme } from './index';

export const THEME_STORAGE_KEY = '@settings/theme_mode';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setScheme: (scheme: 'light' | 'dark' | 'system') => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
  setScheme: () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [userOverride, setUserOverride] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setUserOverride(saved);
        }
      })
      .catch(() => {});
  }, []);

  const activeScheme = userOverride || systemScheme || 'light';
  const isDark = activeScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    const nextMode = isDark ? 'light' : 'dark';
    setUserOverride(nextMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => {});
  };

  const setScheme = (scheme: 'light' | 'dark' | 'system') => {
    if (scheme === 'system') {
      setUserOverride(null);
      AsyncStorage.removeItem(THEME_STORAGE_KEY).catch(() => {});
    } else {
      setUserOverride(scheme);
      AsyncStorage.setItem(THEME_STORAGE_KEY, scheme).catch(() => {});
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
