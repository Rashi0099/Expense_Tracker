import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../app/navigation/types';
import { useOnboarding } from './OnboardingContext';
import { OnboardingHeader } from './components/OnboardingHeader';
import { CategoryChip } from './components/CategoryChip';
import { INCOME_CATEGORY_POOL } from './data/onboardingData';
import { useAuth } from '../../app/providers/AuthProvider';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingStep3'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 16;
const GAP = 6;
const COLS = 3;
const CHIP_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * (COLS - 1)) / COLS;

export const Step3IncomeCategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const { selectedIncomeIds, toggleIncomeCategory, completeOnboarding, isSaving, skipOnboarding } = useOnboarding();
  const { user, markOnboardingComplete } = useAuth();

  const rows = useMemo(() => {
    const result: typeof INCOME_CATEGORY_POOL[] = [];
    for (let i = 0; i < INCOME_CATEGORY_POOL.length; i += COLS) {
      result.push(INCOME_CATEGORY_POOL.slice(i, i + COLS));
    }
    return result;
  }, []);

  const handleFinish = async () => {
    if (!user) return;
    await completeOnboarding(user.id, () => {
      navigation.navigate('OnboardingSuccess');
    });
  };

  const handleSkip = async () => {
    if (user) {
      await skipOnboarding(user.id, () => {
        navigation.navigate('OnboardingSuccess');
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F1E5" />
      <OnboardingHeader
        step={3}
        totalSteps={3}
        onBack={() => navigation.goBack()}
        onSkip={handleSkip}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>What are your sources of income?</Text>
        <Text style={styles.subheading}>Select the categories you want to track.</Text>

        <View style={styles.chipGrid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.chipRow}>
              {row.map((cat) => (
                <CategoryChip
                  key={cat.id}
                  icon={cat.icon}
                  label={cat.name}
                  selected={selectedIncomeIds.includes(cat.id)}
                  onPress={() => toggleIncomeCategory(cat.id)}
                  chipWidth={CHIP_WIDTH}
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
          style={[styles.continueBtn, isSaving && styles.continueBtnLoading]}
          onPress={handleFinish}
          activeOpacity={0.85}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.continueBtnText}>Continue</Text>
              <Text style={styles.continueBtnArrow}>→</Text>
            </>
          )}
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
    minHeight: 54,
  },
  continueBtnLoading: { opacity: 0.8 },
  continueBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  continueBtnArrow: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  privacyRow: { alignItems: 'center', marginTop: 10 },
  privacyText: { fontSize: 11, color: '#9E9E9E' },
});
