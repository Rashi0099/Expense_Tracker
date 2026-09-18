import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, SafeAreaView, useWindowDimensions, Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../app/navigation/types';
import { useOnboarding } from './OnboardingContext';
import { OnboardingHeader } from './components/OnboardingHeader';
import { PROFILE_OPTIONS } from './data/onboardingData';
import { useAuth } from '../../app/providers/AuthProvider';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingStep1'>;

const COLS = 4;
const TILE_MARGIN = 6;

export const Step1ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { width: windowWidth } = useWindowDimensions();
  const safeWidth = windowWidth > 0 ? windowWidth : Dimensions.get('window').width || 360;
  const tileWidth = Math.max(68, Math.floor((safeWidth - 32 - TILE_MARGIN * (COLS - 1)) / COLS));
  const { profile, setProfile, skipOnboarding } = useOnboarding();
  const { user, markOnboardingComplete } = useAuth();

  const handleSkip = async () => {
    if (user) {
      await skipOnboarding(user.id, markOnboardingComplete);
    }
  };

  const handleContinue = () => {
    if (!profile) return;
    navigation.navigate('OnboardingStep2');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F1E5" />
      <OnboardingHeader
        step={1}
        totalSteps={3}
        onSkip={handleSkip}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Which best describes you?</Text>

        <View style={styles.grid}>
          {PROFILE_OPTIONS.map((opt) => {
            const isSelected = profile === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setProfile(opt.id)}
                activeOpacity={0.75}
                style={[
                  styles.tile,
                  { width: tileWidth, height: tileWidth + 14 },
                  isSelected ? styles.tileSelected : styles.tileUnselected,
                ]}
              >
                {isSelected && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
                <Text style={styles.tileEmoji}>{opt.emoji}</Text>
                <Text
                  style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}
                  numberOfLines={2}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <View style={styles.taglineContainer}>
          <Text style={styles.tagline}>Better Money{'\n'}Brighter Days</Text>
        </View>
        <TouchableOpacity
          style={[styles.continueBtn, !profile && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!profile}
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
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#17233C',
    marginBottom: 20,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_MARGIN,
  },
  tile: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    position: 'relative',
  },
  tileUnselected: {
    backgroundColor: '#FFFDF8',
    borderWidth: 1.5,
    borderColor: '#E5DFD5',
  },
  tileSelected: {
    backgroundColor: '#EAF3EE',
    borderWidth: 2,
    borderColor: '#1D5842',
  },
  checkCircle: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1D5842',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 9, color: '#FFF', fontWeight: '700' },
  tileEmoji: { fontSize: 26, marginBottom: 4 },
  tileLabel: {
    fontSize: 10,
    color: '#555',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 13,
  },
  tileLabelSelected: { color: '#1D5842', fontWeight: '700' },
  spacer: { height: 20 },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: '#F7F1E5',
  },
  taglineContainer: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    marginRight: 4,
  },
  tagline: {
    fontSize: 10,
    color: '#9E9E9E',
    textAlign: 'right',
    fontStyle: 'italic',
    lineHeight: 14,
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
  continueBtnDisabled: { backgroundColor: '#A5C4B8', opacity: 0.7 },
  continueBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  continueBtnArrow: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  privacyRow: { alignItems: 'center', marginTop: 10 },
  privacyText: { fontSize: 11, color: '#9E9E9E' },
});
