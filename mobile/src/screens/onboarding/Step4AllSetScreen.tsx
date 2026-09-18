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

  // ─── 1. Checklist Ticks Animations (Tick 1 -> Tick 2 -> Tick 3) ─────────
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

  // ─── 2. Hero Celebration Animations (Appears AFTER 3 ticks complete!) ────
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.2)).current;
  const heroRotate = useRef(new Animated.Value(0)).current;
  const heroGlowScale = useRef(new Animated.Value(0.8)).current;
  const heroGlowOpacity = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(-16)).current;

  // ─── 3. Bottom Button & Alive Pulse ─────────────────────────────────────
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(18)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;

  // ─── 4. Screen Exit Transition ──────────────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fast Snappy Tick Animation Helper (~110ms per row)
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
          tension: 190,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.75, duration: 50, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 1.7, duration: 150, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(bg, {
          toValue: 1,
          duration: 140,
          useNativeDriver: false,
        }),
      ]);

    // Hero Celebration entrance (after the 3 ticks finish!)
    const heroCelebrationAnim = Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(heroScale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(heroRotate, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(heroGlowOpacity, {
        toValue: 0.28,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(heroGlowScale, {
        toValue: 1.25,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(textTranslateY, {
        toValue: 0,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]);

    // Button Entry
    const buttonEntry = Animated.parallel([
      Animated.timing(buttonOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(buttonTranslateY, { toValue: 0, friction: 5, tension: 120, useNativeDriver: true }),
    ]);

    // ─── MASTER SEQUENCE: 3 Ticks First -> Then "You're All Set!" -> Then Button ───
    Animated.sequence([
      Animated.delay(120),
      // 1. Tick 1: Profile saved
      makeFastTickAnim(row1Scale, row1Rotate, row1RingScale, row1RingOpacity, row1BgHighlight),
      Animated.delay(120),
      // 2. Tick 2: Expense categories set
      makeFastTickAnim(row2Scale, row2Rotate, row2RingScale, row2RingOpacity, row2BgHighlight),
      Animated.delay(120),
      // 3. Tick 3: Income sources set
      makeFastTickAnim(row3Scale, row3Rotate, row3RingScale, row3RingOpacity, row3BgHighlight),
      Animated.delay(140),
      // 4. NOW: Hero "You're all set!" Badge & Title Celebration spins in!
      heroCelebrationAnim,
      Animated.delay(100),
      // 5. Button unlocks
      buttonEntry,
    ]).start(() => {
      // Button alive pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, {
            toValue: 1.025,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(buttonPulse, {
            toValue: 1.0,
            duration: 850,
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
        {/* ─── Top Celebration Badge (Spins in after 3 ticks finish!) ────────── */}
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: heroOpacity,
              transform: [{ scale: heroScale }, { rotate: heroSpinDeg }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: heroGlowOpacity,
                transform: [{ scale: heroGlowScale }],
              },
            ]}
          />

          <View style={styles.heroBadge}>
            <View style={styles.innerBadgeRing}>
              <Image source={APP_LOGO} style={styles.heroLogo} resizeMode="contain" />
              <View style={styles.badgeCheckOverlay}>
                <Text style={styles.badgeCheckIcon}>✓</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ─── "You're all set!" Title & Subtitle (Appears with top badge) ──── */}
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
            Your categories are ready and{'\n'}Spending Book is set up for you.
          </Text>
        </Animated.View>

        {/* ─── Checklist Card (Ticks 1, 2, 3 first) ────────────────────────── */}
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
    marginTop: 22,
    marginBottom: 6,
    position: 'relative',
    height: 104,
  },
  glowRing: {
    position: 'absolute',
    width: 114,
    height: 114,
    borderRadius: 57,
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
    marginBottom: 24,
    minHeight: 64,
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
