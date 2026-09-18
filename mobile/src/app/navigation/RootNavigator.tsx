import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Linking } from 'react-native';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { IncomeScreen } from '../../screens/income/IncomeScreen';
import { CategoriesScreen } from '../../screens/categories/CategoriesScreen';
import { RecurringExpensesScreen } from '../../screens/recurring/RecurringExpensesScreen';
import { WalletsScreen } from '../../screens/wallets/WalletsScreen';
import { useAuth } from '../providers/AuthProvider';
import { LoadingState } from '../../components/common/LoadingState';
import { useTheme } from '../../theme/useTheme';
import { APP_LOGO } from '../../assets/appLogo';

const Stack = createNativeStackNavigator<RootStackParamList>();



export const RootNavigator: React.FC = () => {
  const {
    isAuthenticated,
    isLoading,
    isOnboardingCompleted,
    pendingDeepLink,
    setPendingDeepLink,
    consumePendingDeepLink,
  } = useAuth();
  const { theme } = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // Intercept deep links when user is not authenticated to ensure zero crashes & auth continuity
  useEffect(() => {
    if (!isAuthenticated) {
      Linking.getInitialURL().then((url) => {
        if (url) {
          setPendingDeepLink(url);
        }
      });

      const sub = Linking.addEventListener('url', (event) => {
        if (!isAuthenticated) {
          setPendingDeepLink(event.url);
        }
      });

      return () => {
        sub.remove();
      };
    }
  }, [isAuthenticated, setPendingDeepLink]);

  // Once authenticated, resume pending deep link action directly into target screen
  useEffect(() => {
    if (isAuthenticated && pendingDeepLink && navigationRef.isReady()) {
      const targetUrl = consumePendingDeepLink();
      if (targetUrl) {
        if (
          targetUrl.includes('expense/new') ||
          targetUrl.includes('quick-add') ||
          targetUrl.includes('add-expense')
        ) {
          setTimeout(() => {
            navigationRef.navigate('Main' as any, { screen: 'QuickAdd' });
          }, 100);
        }
      }
    }
  }, [isAuthenticated, pendingDeepLink, consumePendingDeepLink, navigationRef]);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <Image
          source={APP_LOGO}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={[styles.splashTitle, { color: theme.colors.textPrimary }]}>
          Spending Book
        </Text>
        <LoadingState message="Initializing your financial space..." />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ animation: 'none' }}
          />
        ) : !isOnboardingCompleted ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingNavigator}
            options={{ animation: 'none' }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ animation: 'none' }}
            />
            <Stack.Screen
              name="Income"
              component={IncomeScreen}
              options={{
                headerShown: true,
                headerTitle: 'Income Streams',
                headerBackTitle: 'Back',
                headerTintColor: theme.colors.textPrimary,
                headerStyle: { backgroundColor: theme.colors.surface },
              }}
            />
            <Stack.Screen
              name="Categories"
              component={CategoriesScreen}
              options={{
                headerShown: true,
                headerTitle: 'Categories',
                headerBackTitle: 'Back',
                headerTintColor: theme.colors.textPrimary,
                headerStyle: { backgroundColor: theme.colors.surface },
              }}
            />
            <Stack.Screen
              name="Recurring"
              component={RecurringExpensesScreen}
              options={{
                headerShown: true,
                headerTitle: 'Recurring Subscriptions',
                headerBackTitle: 'Back',
                headerTintColor: theme.colors.textPrimary,
                headerStyle: { backgroundColor: theme.colors.surface },
              }}
            />
            <Stack.Screen
              name="Wallets"
              component={WalletsScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashLogo: {
    width: 90,
    height: 90,
    marginBottom: 14,
  },
  splashTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
});
