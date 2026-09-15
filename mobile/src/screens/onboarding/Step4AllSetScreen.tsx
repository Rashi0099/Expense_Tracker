import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Easing,
} from 'react-native';
import { APP_LOGO } from '../../assets/appLogo';
import { useAuth } from '../../app/providers/AuthProvider';

const { width } = Dimensions.get('window');

export const Step4AllSetScreen: React.FC = () => {
  const { markOnboardingComplete } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  // ─── Hero Celebration Animations (Rotating & Bouncing Badge) ─────────────
  const heroScale = useRef(new Animated.Value(0.1)).current;
  const heroRotate = useRef(new Animated.Value(0)).current;
  const heroGlowScale = useRef(new Animated.Value(0.8)).current;
  const heroGlowOpacity = useRef(new Animated.Value(0)).current;

  // ─── Confetti / Sparkle Pop Animations ──────────────────────────────────
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;
  const sparkle4 = useRef(new Animated.Value(0)).current;

  // ─── Title & Subtitle Fade-in ───────────────────────────────────────────
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;

  // ─── Checklist Items Ticks Animations ───────────────────────────────────
  const row1Scale = useRef(new Animated.Value(0)).current;
  const row1Rotate = useRef(new Animated.Value(-45)).current;
  const row1RingScale = useRef(new Animated.Value(0.8)).current;
  const row1RingOpacity = useRef(new Animated.Value(0)).current;
  const row1BgHighlight = useRef(new Animated.Value(0)).current;

  const row2Scale = useRef(new Animated.Value(0)).current;
  const row2Rotate = useRef(new Animated.Value(-45)).current;
  const row2RingScale = useRef(new Animated.Value(0.8)).current;
  const row2RingOpacity = useRef(new Animated.Value(0)).current;
  const row2BgHighlight = useRef(new Animated.Value(0)).current;

  const row3Scale = useRef(new Animated.Value(0)).current;
  const row3Rotate = useRef(new Animated.Value(-45)).current;
  const row3RingScale = useRef(new Animated.Value(0.8)).current;
  const row3RingOpacity = useRef(new Animated.Value(0)).current;
  const row3BgHighlight = useRef(new Animated.Value(0)).current;

  // ─── Bottom Button & Pulse ──────────────────────────────────────────────
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(24)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;

  // ─── Smooth Screen Exit Animation ───────────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Hero Badge Spin & Pop in ("onn kargi tik ayi varnnu")
    const heroAnimation = Animated.parallel([
      Animated.spring(heroScale, {
        toValue: 1,
        friction: 4.5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(heroRotate, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(heroGlowOpacity, {
        toValue: 0.35,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(heroGlowScale, {
        toValue: 1.25,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]);

    // 2. Confetti Sparkles Pop
    const sparklesAnim = Animated.stagger(80, [
      Animated.spring(sparkle1, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.spring(sparkle2, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.spring(sparkle3, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.spring(sparkle4, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]);

    // 3. Title slide up
    const titleAnim = Animated.parallel([
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(textTranslateY, { toValue: 0, friction: 6, useNativeDriver: true }),
    ]);

    // 4. Tick Helper for each checklist item
    const makeTickAnim = (
      scale: Animated.Value,
      rotate: Animated.Value,
      ringScale: Animated.Value,
      ringOpacity: Animated.Value,
      bg: Animated.Value
    ) =>
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.8, duration: 80, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 1.8, duration: 250, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(bg, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }),
      ]);

    // 5. Button Entry & Alive Pulse
    const buttonEntry = Animated.parallel([
      Animated.timing(buttonOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(buttonTranslateY, { toValue: 0, friction: 5, tension: 90, useNativeDriver: true }),
    ]);

    // Master Sequence
    Animated.sequence([
      Animated.delay(100),
      heroAnimation,
      sparklesAnim,
      titleAnim,
      Animated.delay(150),
      makeTickAnim(row1Scale, row1Rotate, row1RingScale, row1RingOpacity, row1BgHighlight),
      Animated.delay(180),
      makeTickAnim(row2Scale, row2Rotate, row2RingScale, row2RingOpacity, row2BgHighlight),
      Animated.delay(180),
      makeTickAnim(row3Scale, row3Rotate, row3RingScale, row3RingOpacity, row3BgHighlight),
      Animated.delay(140),
      buttonEntry,
    ]).start(() => {
      // Gentle breathing pulse on the CTA button
      Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, {
            toValue: 1.03,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(buttonPulse, {
            toValue: 1.0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  // Smooth Dashboard Transition
  const handleGoToDashboard = () => {
    if (isNavigating) return;
    setIsNavigating(true);

    // Smooth exit animation
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(screenScale, {
        toValue: 0.96,
        duration: 280,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      markOnboardingComplete();
    });
  };

  const heroSpinDeg = heroRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-180deg', '0deg'],
  });

  const row1RotateDeg = row1Rotate.interpolate({
    inputRange: [-45, 0],
    outputRange: ['-45deg', '0deg'],
  });
  const row2RotateDeg = row2Rotate.interpolate({
    inputRange: [-45, 0],
    outputRange: ['-45deg', '0deg'],
  });
  const row3RotateDeg = row3Rotate.interpolate({
    inputRange: [-45, 0],
    outputRange: ['-45deg', '0deg'],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F1E5" />

      <Animated.View
        style={[
          styles.container,
          {
            opacity: screenOpacity,
            transform: [{ scale: screenScale }],
          },
        ]}
      >
        {/* ─── Hero Rotating Celebration Badge ─────────────────────────────── */}
        <View style={styles.heroSection}>
          {/* Subtle Glow Ring behind */}
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: heroGlowOpacity,
                transform: [{ scale: heroGlowScale }],
              },
            ]}
          />

          {/* Floating Confetti Sparkles */}
          <Animated.Text
            style={[styles.sparkle, styles.spTopLeft, { transform: [{ scale: sparkle1 }] }]}
          >
            ✨
          </Animated.Text>
          <Animated.Text
            style={[styles.sparkle, styles.spTopRight, { transform: [{ scale: sparkle2 }] }]}
          >
            🎉
          </Animated.Text>
          <Animated.Text
            style={[styles.sparkle, styles.spBottomLeft, { transform: [{ scale: sparkle3 }] }]}
          >
            🌿
          </Animated.Text>
          <Animated.Text
            style={[styles.sparkle, styles.spBottomRight, { transform: [{ scale: sparkle4 }] }]}
          >
            ⭐
          </Animated.Text>

          {/* Central Rotating Badge */}
          <Animated.View
            style={[
              styles.heroBadge,
              {
                transform: [{ scale: heroScale }, { rotate: heroSpinDeg }],
              },
            ]}
          >
            <View style={styles.innerBadgeRing}>
              <Image source={APP_LOGO} style={styles.heroLogo} resizeMode="contain" />
              <View style={styles.badgeCheckOverlay}>
                <Text style={styles.badgeCheckIcon}>✓</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ─── Celebration Title & Tagline ─────────────────────────────────── */}
        <Animated.View
          style={[
            styles.titleSection,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.title}>You’re all set!</Text>
          <Text style={styles.subtitle}>
            Your categories are ready and{'\n'}CashFlow is set up for you.
          </Text>
        </Animated.View>

        {/* ─── Aesthetic Checklist Card ────────────────────────────────────── */}
        <View style={styles.card}>
          {/* Row 1: Profile saved */}
          <Animated.View
            style={[
              styles.row,
              {
                backgroundColor: row1BgHighlight.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#FFFFFF', '#F0F9F4'],
                }),
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.rowIcon}>👤</Text>
            </View>
            <Text style={styles.rowLabel}>Profile saved</Text>

            {/* Ripple Expanding Ring */}
            <Animated.View
              style={[
                styles.tickRipple,
                {
                  opacity: row1RingOpacity,
                  transform: [{ scale: row1RingScale }],
                },
              ]}
            />
            {/* Animated Checkmark Circle */}
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  transform: [{ scale: row1Scale }, { rotate: row1RotateDeg }],
                },
              ]}
            >
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          </Animated.View>

          {/* Row 2: Expense categories set */}
          <Animated.View
            style={[
              styles.row,
              {
                backgroundColor: row2BgHighlight.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#FFFFFF', '#F0F9F4'],
                }),
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.rowIcon}>📋</Text>
            </View>
            <Text style={styles.rowLabel}>Expense categories set</Text>

            {/* Ripple Expanding Ring */}
            <Animated.View
              style={[
                styles.tickRipple,
                {
                  opacity: row2RingOpacity,
                  transform: [{ scale: row2RingScale }],
                },
              ]}
            />
            {/* Animated Checkmark Circle */}
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  transform: [{ scale: row2Scale }, { rotate: row2RotateDeg }],
                },
              ]}
            >
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          </Animated.View>

          {/* Row 3: Income sources set */}
          <Animated.View
            style={[
              styles.row,
              styles.lastRow,
              {
                backgroundColor: row3BgHighlight.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#FFFFFF', '#F0F9F4'],
                }),
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.rowIcon}>📊</Text>
            </View>
            <Text style={styles.rowLabel}>Income sources set</Text>

            {/* Ripple Expanding Ring */}
            <Animated.View
              style={[
                styles.tickRipple,
                {
                  opacity: row3RingOpacity,
                  transform: [{ scale: row3RingScale }],
                },
              ]}
            />
            {/* Animated Checkmark Circle */}
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  transform: [{ scale: row3Scale }, { rotate: row3RotateDeg }],
                },
              ]}
            >
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          </Animated.View>
        </View>

        <View style={styles.flexSpacer} />

        {/* ─── Bottom CTA with Breathing Pulse ─────────────────────────────── */}
        <Animated.View
          style={[
            styles.footer,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }, { scale: buttonPulse }],
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
            <Text style={styles.mottoText}>Let’s build a smarter you, financially ✨</Text>
          </View>
        </Animated.View>
      </Animated.View>
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
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
    position: 'relative',
    height: 110,
  },
  glowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#A7D7C5',
  },
  heroBadge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D5842',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#D4E8DC',
    position: 'relative',
  },
  innerBadgeRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EAF3EE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroLogo: {
    width: 44,
    height: 44,
  },
  badgeCheckOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1D5842',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeCheckIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  sparkle: {
    position: 'absolute',
    fontSize: 20,
  },
  spTopLeft: { top: 6, left: width * 0.22 },
  spTopRight: { top: 8, right: width * 0.22 },
  spBottomLeft: { bottom: 10, left: width * 0.2 },
  spBottomRight: { bottom: 12, right: width * 0.2 },
  titleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '400',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#D4E8DC',
    shadowColor: '#1D5842',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginVertical: 3,
    position: 'relative',
  },
  lastRow: {
    marginBottom: 0,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1D5842',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowIcon: {
    fontSize: 18,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '600',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1D5842',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  tickRipple: {
    position: 'absolute',
    right: 13,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1D5842',
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  continueBtnArrow: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  mottoWrapper: {
    alignItems: 'center',
    marginTop: 14,
  },
  mottoText: {
    fontSize: 12,
    color: '#718096',
    fontStyle: 'italic',
    fontWeight: '500',
  },
});
