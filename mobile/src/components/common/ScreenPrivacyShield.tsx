/**
 * Screen Privacy Shield (Section 40)
 *
 * Protects sensitive financial information from appearing in system app-switcher
 * snapshots when the user switches between apps.
 *
 * Listens to AppState changes:
 * - When transitioning to 'inactive' or 'background', displays a privacy overlay.
 * - When transitioning back to 'active', immediately dismisses the overlay.
 * - Configurable via user setting (defaults to enabled).
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/useTheme';
import { useAuth } from '../../app/providers/AuthProvider';
import { APP_LOGO } from '../../assets/appLogo';

const PRIVACY_SETTING_KEY = '@settings/privacy_shield_enabled';

interface ScreenPrivacyContextValue {
  isPrivacyShieldEnabled: boolean;
  setPrivacyShieldEnabled: (enabled: boolean) => Promise<void>;
}

const ScreenPrivacyContext = createContext<ScreenPrivacyContextValue>({
  isPrivacyShieldEnabled: true,
  setPrivacyShieldEnabled: async () => {},
});

export const useScreenPrivacy = () => useContext(ScreenPrivacyContext);

interface ScreenPrivacyShieldProps {
  children: React.ReactNode;
}

export const ScreenPrivacyShield: React.FC<ScreenPrivacyShieldProps> = ({ children }) => {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const [isShieldActive, setIsShieldActive] = useState(false);
  const [isPrivacyShieldEnabled, setIsPrivacyShieldEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(PRIVACY_SETTING_KEY)
      .then((val) => {
        if (val !== null) {
          setIsPrivacyShieldEnabled(val === 'true');
        }
      })
      .catch(() => {});
  }, []);

  const setPrivacyShieldEnabled = async (enabled: boolean) => {
    setIsPrivacyShieldEnabled(enabled);
    await AsyncStorage.setItem(PRIVACY_SETTING_KEY, String(enabled)).catch(() => {});
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Never activate privacy shield if user is not authenticated or still loading
      if (!isAuthenticated || isLoading || !isPrivacyShieldEnabled) {
        setIsShieldActive(false);
        return;
      }

      if (nextAppState === 'inactive' || nextAppState === 'background') {
        setIsShieldActive(true);
      } else if (nextAppState === 'active') {
        // Smooth dismissal after app window settles
        setTimeout(() => {
          setIsShieldActive(false);
        }, 150);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, isLoading, isPrivacyShieldEnabled]);

  const showOverlay = isShieldActive && isAuthenticated && !isLoading && isPrivacyShieldEnabled;

  return (
    <ScreenPrivacyContext.Provider
      value={{
        isPrivacyShieldEnabled,
        setPrivacyShieldEnabled,
      }}
    >
      {children}

      {showOverlay ? (
        <View
          style={[
            styles.shieldOverlay,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Image
            source={APP_LOGO}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Spending Book
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            🔒 Financial details protected
          </Text>
        </View>
      ) : null}
    </ScreenPrivacyContext.Provider>
  );
};

const styles = StyleSheet.create({
  shieldOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    width: 84,
    height: 84,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
