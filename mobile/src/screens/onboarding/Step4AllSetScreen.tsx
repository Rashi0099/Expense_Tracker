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
  Easing,
} from 'react-native';
import { APP_LOGO } from '../../assets/appLogo';
import { useAuth } from '../../app/providers/AuthProvider';

export const Step4AllSetScreen: React.FC = () => {
  const { markOnboardingComplete } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  // ─── Hero Celebration Badge Animations (Fast, Snappy & Aesthetic) ────────
  const heroScale = useRef(new Animated.Value(0.2)).current;
  const heroRotate = useRef(new Animated.Value(0)).current;
  const heroGlowScale = useRef(new Animated.Value(0.9)).current;
  const heroGlowOpacity = useRef(new Animated.Value(0)).current;

  // ─── Title & Subtitle Fade ───────────────────────────────────────────────
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(14)).current;

  // ─── Fast Sequential Checklist Ticks ─────────────────────────────────────
  const row1Scale = useRef(new Animated.Value(0)).current;
  const row1Rotate = useRef(new Animated.Value(-35)).current;
  const row1RingScale = useRef(new Animated.Value(0.8)).current;
  const row1RingOpacity = useRef(new Animated.Value(0)).current;
  const row1BgHighlight = useRef(new Animated.Value(0)).current;

  const row2Scale = useRef(new Animated.Value(0)).current;
  const row2Rotate = useRef(new Animated.Value(-35)).current;
  const row2RingScale = useRef(new Animated.Value(0.8)).current;
  const row2RingOpacity = useRef(new Animated.Value(0)).current;
  const row2BgHighlight = useRef(new Animated.Value(0)).current;

  const row3Scale = useRef(new Animated.Value(0)).current;
  const row3Rotate = useRef(new Animated.Value(-35)).current;
  const row3RingScale = useRef(new Animated.Value(0.8)).current;
  const row3RingOpacity = useRef(new Animated.Value(0)).current;
  const row3BgHighlight = useRef(new Animated.Value(0)).current;

  // ─── Bottom Button & Pulse ──────────────────────────────────────────────
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(18)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;

  // ─── Screen Exit Transition ─────────────────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Hero Badge fast spin & pop in
    const heroAnimation = Animated.parallel([
      Animated.spring(heroScale, {
        toValue: 1,
        friction: 5,
        tension: 130,
        useNativeDriver: true,
      }),
      Animated.timing(heroRotate, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(heroGlowOpacity, {
        toValue: 0.28,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(heroGlowScale, {
        toValue: 1.2,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
    ]);

    // 2. Title & Subtitle fast entry
    const titleAnim = Animated.parallel([
      Animated.timing(textOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(textTranslateY, { toValue: 0, friction: 6, tension: 120, useNativeDriver: true }),
    ]);

    // 3. Fast Snappy Tick Helper (~110ms per row)
    const makeFastTickAnim = (
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
          tension: 180,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.7, duration: 60, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 1.6, duration: 160, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(bg, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
      ]);

    // 4. CTA Button Entry
    const buttonEntry = Animated.parallel([
      Animated.timing(buttonOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(buttonTranslateY, { toValue: 0, friction: 5, tension: 120, useNativeDriver: true }),
    ]);

    // Master Fast Sequence: Crisp, snappy, finished in ~650ms total!
    Animated.sequence([
      Animated.delay(50),
      Animated.parallel([heroAnimation, titleAnim]),
      Animated.delay(90),
      makeFastTickAnim(row1Scale, row1Rotate, row1RingScale, row1RingOpacity, row1BgHighlight),
      Animated.delay(110),
      makeFastTickAnim(row2Scale, row2Rotate, row2RingScale, row2RingOpacity, row2BgHighlight),
      Animated.delay(110),
      makeFastTickAnim(row3Scale, row3Rotate, row3RingScale, row3RingOpacity, row3BgHighlight),
      Animated.delay(90),
      buttonEntry,
    ]).start(() => {
      // Gentle alive pulse on button
      Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, {
            toValue: 1.025,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(buttonPulse, {
            toValue: 1.0,
            duration: 800,
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

    // Smooth elegant fade-out into dashboard
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(screenScale, {
        toValue: 0.97,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      markOnboardingComplete();
    });
  };

  const heroSpinDeg = heroRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-120deg', '0deg'],
  });

  const row1RotateDeg = row1Rotate.interpolate({
    inputRange: [-35, 0],
    outputRange: ['-35deg', '0deg'],
  });
  const row2RotateDeg = row2Rotate.interpolate({
    inputRange: [-35, 0],
    outputRange: ['-35deg', '0deg'],
  });
  const row3RotateDeg = row3Rotate.interpolate({
    inputRange: [-35, 0],
    outputRange: ['-35deg', '0deg'],
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
        {/* ─── Hero Rotating Badge (Clean, Aesthetic, No floating emoji sparkles) ─── */}
        <View style={styles.heroSection}>
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: heroGlowOpacity,
                transform: [{ scale: heroGlowScale }],
              },
            ]}
          />

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

        {/* ─── Title & Subtitle ────────────────────────────────────────────── */}
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

        {/* ─── Premium Checklist Card ──────────────────────────────────────── */}
        <View style={styles.card}>
          {/* Row 1: Profile saved */}
          <Animated.View
            style={[
              styles.row,
              {
                backgroundColor: row1BgHighlight.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#FFFFFF', '#F2FAF5'],
                }),
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.rowIconText}>👤</Text>
            </View>
            <Text style={styles.rowLabel}>Profile saved</Text>

            <Animated.View
              style={[
                styles.tickRipple,
                {
                  opacity: row1RingOpacity,
                  transform: [{ scale: row1RingScale }],
                },
              ]}
            />
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
                  outputRange: ['#FFFFFF', '#F2FAF5'],
                }),
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.rowIconText}>☰</Text>
            </View>
            <Text style={styles.rowLabel}>Expense categories set</Text>

            <Animated.View
              style={[
                styles.tickRipple,
                {
                  opacity: row2RingOpacity,
                  transform: [{ scale: row2RingScale }],
                },
              ]}
            />
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
                  outputRange: ['#FFFFFF', '#F2FAF5'],
                }),
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.rowIconText}>📈</Text>
            </View>
            <Text style={styles.rowLabel}>Income sources set</Text>

            <Animated.View
              style={[
                styles.tickRipple,
                {
                  opacity: row3RingOpacity,
                  transform: [{ scale: row3RingScale }],
                },
              ]}
            />
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

        {/* ─── Bottom CTA with Smooth Pulse ─────────────────────────────────── */}
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
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Go to Dashboard</Text>
            <Text style={styles.continueBtnArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.mottoWrapper}>
            <Text style={styles.mottoText}>Let’s build a smarter you, financially.</Text>
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
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 8,
    position: 'relative',
    height: 110,
  },
  glowRing: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#1D5842',
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
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#D7E5DC',
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
    bottom: -3,
    right: -3,
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
  titleSection: {
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E2DDD4',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginVertical: 2,
    position: 'relative',
  },
  lastRow: {
    marginBottom: 0,
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
  rowIconText: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
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
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    fontWeight: '500',
  },
});
