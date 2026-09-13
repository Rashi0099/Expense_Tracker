import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { DashboardScreen } from '../../screens/dashboard/DashboardScreen';
import { ExpensesListScreen } from '../../screens/expenses/ExpensesListScreen';
import { QuickExpenseScreen } from '../../screens/capture/QuickExpenseScreen';
import { BudgetsScreen } from '../../screens/budgets/BudgetsScreen';
import { SettingsScreen } from '../../screens/settings/SettingsScreen';
import { useTheme } from '../../theme/useTheme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.surfaceBorder,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 20 : 18 }}>🏠</Text>
          ),
        }}
      />

      <Tab.Screen
        name="Expenses"
        component={ExpensesListScreen}
        options={{
          tabBarLabel: 'Expenses',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 20 : 18 }}>💳</Text>
          ),
        }}
      />

      <Tab.Screen
        name="QuickAdd"
        component={QuickExpenseScreen}
        options={{
          tabBarLabel: 'Add',
          tabBarIcon: () => (
            <View
              style={[
                styles.addFab,
                {
                  backgroundColor: theme.colors.primary,
                  shadowColor: theme.colors.primary,
                },
              ]}
            >
              <Text style={styles.addFabText}>+</Text>
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{
          tabBarLabel: 'Budgets',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 20 : 18 }}>🎯</Text>
          ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 20 : 18 }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  addFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  addFabText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
});
