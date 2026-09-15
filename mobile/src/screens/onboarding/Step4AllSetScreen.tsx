import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { APP_LOGO } from '../../assets/appLogo';
import { useAuth } from '../../app/providers/AuthProvider';

export const Step4AllSetScreen: React.FC = () => {
  const { markOnboardingComplete } = useAuth();

  // Animation values for the 3 checkmarks and bottom button
  const check1Scale = useRef(new Animated.Value(0)).current;
  const check1Opacity = useRef(new Animated.Value(0)).current;

  const check2Scale = useRef(new Animated.Value(0)).current;
  const check2Opacity = useRef(new Animated.Value(0)).current;

  const check3Scale = useRef(new Animated.Value(0)).current;
  const check3Opacity = useRef(new Animated.Value(0)).current;

  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    // Sequential tick animations: Row 1 -> Row 2 -> Row 3 -> Button
    const anim1 = Animated.parallel([
      Animated.spring(check1Scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(check1Opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]);

    const anim2 = Animated.parallel([
      Animated.spring(check2Scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(check2Opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]);

    const anim3 = Animated.parallel([
      Animated.spring(check3Scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(check3Opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]);

    const animButton = Animated.parallel([
      Animated.timing(buttonOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(buttonTranslateY, { toValue: 0, friction: 6, tension: 100, useNativeDriver: true }),
    ]);

    const timer = setTimeout(() => {
      Animated.sequence([
        anim1,
        Animated.delay(220),
        anim2,
        Animated.delay(220),
        anim3,
        Animated.delay(180),
        animButton,
      ]).start();
    }, 250);

    return () => clearTimeout(timer);
  }, [check1Scale, check1Opacity, check2Scale, check2Opacity, check3Scale, check3Opacity, buttonOpacity, buttonTranslateY]);

  const handleGoToDashboard = () => {
    markOnboardingComplete();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F1E5" />

      <View style={styles.container}>
        {/* Top Centered Brand Logo */}
        <View style={styles.topLogoWrapper}>
          <View style={styles.logoCircle}>
            <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
          </View>
        </View>

        {/* Title & Subtitle */}
        <View style={styles.header}>
          <Text style={styles.title}>You’re all set!</Text>
          <Text style={styles.subtitle}>
            Your categories are ready and{'\n'}CashFlow is set up for you.
          </Text>
        </View>

        {/* Checklist Card */}
        <View style={styles.card}>
          {/* Row 1: Profile saved */}
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Text style={styles.rowIcon}>👤</Text>
            </View>
            <Text style={styles.rowLabel}>Profile saved</Text>
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  opacity: check1Opacity,
                  transform: [{ scale: check1Scale }],
                },
              ]}
            >
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          </View>

          {/* Row 2: Expense categories set */}
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Text style={styles.rowIcon}>📋</Text>
            </View>
            <Text style={styles.rowLabel}>Expense categories set</Text>
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  opacity: check2Opacity,
                  transform: [{ scale: check2Scale }],
                },
              ]}
            >
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          </View>

          {/* Row 3: Income sources set */}
          <View style={[styles.row, styles.lastRow]}>
            <View style={styles.iconCircle}>
              <Text style={styles.rowIcon}>📊</Text>
            </View>
            <Text style={styles.rowLabel}>Income sources set</Text>
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  opacity: check3Opacity,
                  transform: [{ scale: check3Scale }],
                },
              ]}
            >
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          </View>
        </View>

        <View style={styles.flexSpacer} />

        {/* Bottom CTA Button & Motto */}
        <Animated.View
          style={[
            styles.footer,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleGoToDashboard}
            activeOpacity={0.88}
          >
            <Text style={styles.continueBtnText}>Go to Dashboard</Text>
            <Text style={styles.continueBtnArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.mottoWrapper}>
            <Text style={styles.mottoText}>Let’s build a brighter financial tomorrow 🌿</Text>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F1E5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  topLogoWrapper: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 12,
  },
  logoCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D5842',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#E2DFD6',
  },
  logo: {
    width: 48,
    height: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#17233C',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '400',
  },
  card: {
    backgroundColor: '#EDF5EE',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D4E8DC',
    shadowColor: '#1D5842',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0EFE6',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1D5842',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowIcon: {
    fontSize: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1D5842',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  flexSpacer: {
    flex: 1,
  },
  footer: {
    paddingTop: 16,
  },
  continueBtn: {
    backgroundColor: '#1D5842',
    borderRadius: 28,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1D5842',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  continueBtnArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  mottoWrapper: {
    alignItems: 'center',
    marginTop: 14,
  },
  mottoText: {
    fontSize: 11.5,
    color: '#8A99AD',
    fontStyle: 'italic',
  },
});
