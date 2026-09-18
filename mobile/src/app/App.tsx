import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/useTheme';
import { AuthProvider } from './providers/AuthProvider';
import { WalletProvider } from './providers/WalletProvider';
import { BalanceVisibilityProvider } from './providers/BalanceVisibilityProvider';
import { RootNavigator } from './navigation/RootNavigator';
import { ScreenPrivacyShield } from '../components/common/ScreenPrivacyShield';
import { SecurityLockOverlay } from '../components/common/SecurityLockOverlay';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { hotUpdateService } from '../services/HotUpdateService';
import { reminderService } from '../services/reminderService';

export const App: React.FC = () => {
  useEffect(() => {
    // Initialize 3x daily reminder alarms
    reminderService.init().catch(() => {});

    // Background check for updates after startup (silent download for next launch)
    const timer = setTimeout(async () => {
      try {
        const update = await hotUpdateService.checkForUpdate();
        if (update.isAvailable && update.bundleUrl && update.latestVersion) {
          await hotUpdateService.downloadUpdate(
            update.bundleUrl,
            update.latestVersion
          );
          // Downloaded safely in background; will be loaded automatically on next app launch.
          // Never force reloadApp() while the user is actively using the app.
        }
      } catch {
        // Silent catch for background check
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <WalletProvider>
              <BalanceVisibilityProvider>
                <ScreenPrivacyShield>
                  <RootNavigator />
                  <SecurityLockOverlay />
                </ScreenPrivacyShield>
              </BalanceVisibilityProvider>
            </WalletProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
