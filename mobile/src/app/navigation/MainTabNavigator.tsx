import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { DashboardScreen } from '../../screens/dashboard/DashboardScreen';
import { ExpensesListScreen } from '../../screens/expenses/ExpensesListScreen';
import { QuickExpenseScreen } from '../../screens/capture/QuickExpenseScreen';
import { BudgetsScreen } from '../../screens/budgets/BudgetsScreen';
import { SettingsScreen } from '../../screens/settings/SettingsScreen';
import { useTheme } from '../../theme/useTheme';
import {
  IconOverview,
  IconExpenses,
  IconAdd,
  IconBudgets,
  IconSettings,
} from '../../components/common/NavIcons';

const Tab = createBottomTabNavigator<MainTabParamList>();

const CleanTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation, insets }) => {
  const { theme } = useTheme();

  const renderIcon = (name: string, isFocused: boolean, color: string) => {
    switch (name) {
      case 'Home':
        return <IconOverview color={color} size={20} focused={isFocused} />;
      case 'Expenses':
        return <IconExpenses color={color} size={20} focused={isFocused} />;
      case 'Budgets':
        return <IconBudgets color={color} size={20} focused={isFocused} />;
      case 'Settings':
        return <IconSettings color={color} size={20} focused={isFocused} />;
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.surfaceBorder,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isAdd = route.name === 'QuickAdd';

        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const iconColor = isFocused ? theme.colors.primary : theme.colors.textMuted;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        if (isAdd) {
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel="Add Expense"
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
              activeOpacity={0.7}
              delayPressIn={0}
            >
              <View
                style={[
                  styles.addFab,
                  {
                    backgroundColor: theme.colors.primary,
                    shadowColor: theme.colors.primary,
                  },
                ]}
              >
                <IconAdd color="#FFFFFF" size={20} />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: isFocused ? theme.colors.primary : theme.colors.textMuted,
                    fontWeight: isFocused ? '700' : '600',
                  },
                ]}
              >
                Add
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={typeof label === 'string' ? label : route.name}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <View style={styles.iconContainer}>
              {renderIcon(route.name, isFocused, iconColor)}
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: iconColor,
                  fontWeight: isFocused ? '700' : '500',
                },
              ]}
            >
              {typeof label === 'string' ? label : route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CleanTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        unmountOnBlur: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Overview',
        }}
      />

      <Tab.Screen
        name="Expenses"
        component={ExpensesListScreen}
        options={{
          tabBarLabel: 'Transactions',
        }}
      />

      <Tab.Screen
        name="QuickAdd"
        component={QuickExpenseScreen}
        options={{
          tabBarLabel: 'Add',
        }}
      />

      <Tab.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{
          tabBarLabel: 'Budgets',
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingHorizontal: 8,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    letterSpacing: -0.2,
  },
  addFab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
