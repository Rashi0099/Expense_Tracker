import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from './types';
import { OnboardingProvider } from '../../screens/onboarding/OnboardingContext';
import { Step1ProfileScreen } from '../../screens/onboarding/Step1ProfileScreen';
import { Step2ExpenseCategoriesScreen } from '../../screens/onboarding/Step2ExpenseCategoriesScreen';
import { Step3IncomeCategoriesScreen } from '../../screens/onboarding/Step3IncomeCategoriesScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator: React.FC = () => {
  return (
    <OnboardingProvider>
      <Stack.Navigator
        initialRouteName="OnboardingStep1"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="OnboardingStep1" component={Step1ProfileScreen} />
        <Stack.Screen name="OnboardingStep2" component={Step2ExpenseCategoriesScreen} />
        <Stack.Screen name="OnboardingStep3" component={Step3IncomeCategoriesScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
};
