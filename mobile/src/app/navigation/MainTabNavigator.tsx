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

const Tab = createBottomTabNavigator<MainTabParamList>();

const CleanTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation, insets }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.surfaceBorder,
          paddingBottom: Math.max(insets.bottom, 10),
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
              accessibilityLabel={typeof label === 'string' ? label : 'Add Expense'}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.addPill,
                  {
                    backgroundColor: theme.colors.primary,
                    shadowColor: theme.colors.primary,
                  },
                ]}
              >
                <Text style={styles.addPillText}>+ Add</Text>
              </View>
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
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.pill,
                isFocused && {
                  backgroundColor: theme.colors.primaryLight,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color: isFocused ? theme.colors.primary : theme.colors.textMuted,
                    fontWeight: isFocused ? '700' : '600',
                  },
                ]}
              >
                {typeof label === 'string' ? label : route.name}
              </Text>
            </View>
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
          tabBarLabel: 'Expenses',
        }}
      />

      <Tab.Screen
        name="QuickAdd"
        component={QuickExpenseScreen}
        options={{
          tabBarLabel: '+ Add',
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
    paddingTop: 8,
    paddingHorizontal: 8,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  label: {
    fontSize: 12.5,
    letterSpacing: -0.2,
  },
  addPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
