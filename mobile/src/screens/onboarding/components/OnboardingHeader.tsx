import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { APP_LOGO } from '../../../assets/appLogo';

interface OnboardingHeaderProps {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  onSkip: () => void;
}

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({
  step,
  totalSteps,
  onBack,
  onSkip,
}) => {
  return (
    <View style={styles.container}>
      {/* Logo row */}
      <View style={styles.logoRow}>
        <View style={styles.logoLeft}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          )}
          <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
          <View style={styles.logoTextCol}>
            <Text style={styles.logoName}>CashFlow</Text>
            <Text style={styles.logoTagline}>A smarter you, financially.</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onSkip} style={styles.skipBtn} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressPill,
              i < step ? styles.pillCompleted : i === step - 1 ? styles.pillActive : styles.pillInactive,
            ]}
          />
        ))}
      </View>
      <Text style={styles.stepLabel}>Step {step} of {totalSteps}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: '#F7F1E5',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  logoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: 8,
    paddingRight: 4,
  },
  backArrow: {
    fontSize: 20,
    color: '#1D5842',
    fontWeight: '700',
  },
  logo: {
    width: 30,
    height: 30,
    marginRight: 8,
  },
  logoTextCol: {
    flexDirection: 'column',
  },
  logoName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#17233C',
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  logoTagline: {
    fontSize: 10,
    color: '#8E9BAE',
    lineHeight: 14,
  },
  skipBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C8C0B0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFFDF8',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D5842',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  progressPill: {
    height: 4,
    borderRadius: 2,
  },
  pillActive: {
    width: 40,
    backgroundColor: '#1D5842',
  },
  pillCompleted: {
    width: 40,
    backgroundColor: '#1D5842',
    opacity: 0.4,
  },
  pillInactive: {
    width: 40,
    backgroundColor: '#C8C0B0',
  },
  stepLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#8E9BAE',
    marginBottom: 6,
  },
});
