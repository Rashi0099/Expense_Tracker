import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/useTheme';
import { AuthProvider } from './providers/AuthProvider';
import { RootNavigator } from './navigation/RootNavigator';

import { ScreenPrivacyShield } from '../components/common/ScreenPrivacyShield';

export const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ScreenPrivacyShield>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ScreenPrivacyShield>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App;
