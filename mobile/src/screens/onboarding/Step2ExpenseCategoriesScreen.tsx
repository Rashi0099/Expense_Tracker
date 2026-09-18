import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, SafeAreaView, useWindowDimensions, Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../app/navigation/types';
import { useOnboarding } from './OnboardingContext';
import { OnboardingHeader } from './components/OnboardingHeader';
import { CategoryChip } from './components/CategoryChip';
import { EXPENSE_CATEGORY_POOL } from './data/onboardingData';
import { useAuth } from '../../app/providers/AuthProvider';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingStep2'>;

const PADDING = 16;
const GAP = 6;
const COLS = 3;

export const Step2ExpenseCategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const { width: windowWidth } = useWindowDimensions();
  const safeWidth = windowWidth > 0 ? windowWidth : Dimensions.get('window').width || 360;
  const chipWidth = Math.max(90, Math.floor((safeWidth - PADDING * 2 - GAP * (COLS - 1)) / COLS));
  const { selectedExpenseIds, toggleExpenseCategory, skipOnboarding } = useOnboarding();
  const { user, markOnboardingComplete } = useAuth();

  // Arrange chips in rows of COLS
  const rows = useMemo(() => {
    const result: typeof EXPENSE_CATEGORY_POOL[] = [];
    for (let i = 0; i < EXPENSE_CATEGORY_POOL.length; i += COLS) {
      result.push(EXPENSE_CATEGORY_POOL.slice(i, i + COLS));
    }
    return result;
  }, []);

  const handleSkip = async () => {
    if (user) await skipOnboarding(user.id, markOnboardingComplete);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F1E5" />
      <OnboardingHeader
        step={2}
        totalSteps={3}
        onBack={() => navigation.goBack()}
        onSkip={handleSkip}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>What do you usually spend on?</Text>
        <Text style={styles.subheading}>Select the categories you want to track.</Text>

        <View style={styles.chipGrid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.chipRow}>
              {row.map((cat) => (
                <CategoryChip
                  key={cat.id}
                  icon={cat.icon}
                  label={cat.name}
                  selected={selectedExpenseIds.includes(cat.id)}
                  onPress={() => toggleExpenseCategory(cat.id)}
                  chipWidth={chipWidth}
                />
              ))}
            </View>
          ))}
        </View>

        {/* Info hint */}
        <View style={styles.hintBox}>
          <Text style={styles.hintIcon}>💡</Text>
          <Text style={styles.hintText}>
            You can add, edit or create new categories anytime from the app.
          </Text>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => navigation.navigate('OnboardingStep3')}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
          <Text style={styles.continueBtnArrow}>→</Text>
        </TouchableOpacity>
        <View style={styles.privacyRow}>
          <Text style={styles.privacyText}>🔒  Your information is private and secure.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F1E5' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: PADDING, paddingTop: 18, paddingBottom: 20 },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#17233C',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13,
    color: '#8E9BAE',
    marginBottom: 20,
  },
  chipGrid: { gap: 0 },
  chipRow: {
    flexDirection: 'row',
    gap: GAP,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEECE6',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  hintIcon: { fontSize: 16 },
  hintText: { fontSize: 12, color: '#5A6A7E', flex: 1, lineHeight: 17 },
  spacer: { height: 20 },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: '#F7F1E5',
  },
  continueBtn: {
    backgroundColor: '#1D5842',
    borderRadius: 28,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  continueBtnArrow: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  privacyRow: { alignItems: 'center', marginTop: 10 },
  privacyText: { fontSize: 11, color: '#9E9E9E' },
});
