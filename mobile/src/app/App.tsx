import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/useTheme';
import { AuthProvider } from './providers/AuthProvider';
import { RootNavigator } from './navigation/RootNavigator';
import { ScreenPrivacyShield } from '../components/common/ScreenPrivacyShield';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { hotUpdateService } from '../services/HotUpdateService';
import { reminderService } from '../services/reminderService';

export const App: React.FC = () => {
  useEffect(() => {
    // Initialize 3x daily reminder alarms
    reminderService.init().catch(() => {});

    // Silent background check for updates after startup
    const timer = setTimeout(async () => {
      try {
        const update = await hotUpdateService.checkForUpdate();
        if (update.isAvailable && update.bundleUrl && update.latestVersion) {
          await hotUpdateService.downloadUpdate(
            update.bundleUrl,
            update.latestVersion
          );
        }
      } catch {
        // Silent catch for background check
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <ScreenPrivacyShield>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ScreenPrivacyShield>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
