import React from 'react';
import { View, StyleSheet } from 'react-native';

interface IconProps {
  color: string;
  size?: number;
  focused?: boolean;
}

/**
 * Modern House / Home Overview Icon matching reference UX
 */
export const IconOverview: React.FC<IconProps> = ({
  color,
  size = 20,
  focused = false,
}) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Roof */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: Math.round(size * 0.44),
          borderRightWidth: Math.round(size * 0.44),
          borderBottomWidth: Math.round(size * 0.38),
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      {/* House Body */}
      <View
        style={{
          width: Math.round(size * 0.62),
          height: Math.round(size * 0.44),
          backgroundColor: color,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
        }}
      />
    </View>
  );
};

/**
 * Modern Credit Card / Expense Icon
 * Strictly monochrome, no emojis.
 */
export const IconExpenses: React.FC<IconProps> = ({
  color,
  size = 20,
  focused = false,
}) => {
  const width = size;
  const height = Math.round(size * 0.72);

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width,
          height,
          borderRadius: 3.5,
          borderWidth: 1.6,
          borderColor: color,
          backgroundColor: focused ? `${color}18` : 'transparent',
          overflow: 'hidden',
        }}
      >
        {/* Card magnetic stripe */}
        <View
          style={{
            width: '100%',
            height: 3,
            backgroundColor: color,
            marginTop: 2.5,
          }}
        />
        {/* Card chip */}
        <View
          style={{
            width: 4,
            height: 3,
            borderRadius: 1,
            backgroundColor: color,
            marginLeft: 3,
            marginTop: 2.5,
          }}
        />
      </View>
    </View>
  );
};

/**
 * Modern Clean Plus (+) Icon
 * Strictly monochrome.
 */
export const IconAdd: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 20,
}) => {
  const barLen = Math.round(size * 0.62);
  const barThick = 2;

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          width: barLen,
          height: barThick,
          borderRadius: barThick / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: barThick,
          height: barLen,
          borderRadius: barThick / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
};

/**
 * Modern 3-Bar Analytics / Budget Icon (Revolut / Wise style)
 * Strictly monochrome, no emojis.
 */
export const IconBudgets: React.FC<IconProps> = ({
  color,
  size = 20,
  focused = false,
}) => {
  const barWidth = 3.5;

  return (
    <View
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 3,
        paddingBottom: 2,
      }}
    >
      <View
        style={{
          width: barWidth,
          height: Math.round(size * 0.45),
          borderRadius: 1.5,
          backgroundColor: color,
          opacity: focused ? 1 : 0.65,
        }}
      />
      <View
        style={{
          width: barWidth,
          height: Math.round(size * 0.8),
          borderRadius: 1.5,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: barWidth,
          height: Math.round(size * 0.6),
          borderRadius: 1.5,
          backgroundColor: color,
          opacity: focused ? 1 : 0.65,
        }}
      />
    </View>
  );
};

/**
 * Modern Gear / Settings Icon matching reference UX
 */
export const IconSettings: React.FC<IconProps> = ({
  color,
  size = 20,
  focused = false,
}) => {
  const outerR = Math.round(size * 0.4);
  const barW = Math.round(size * 0.88);
  const barH = Math.round(size * 0.3);
  const innerR = Math.round(size * 0.16);

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* 3 crossing bars for 6 teeth */}
      <View
        style={{
          position: 'absolute',
          width: barW,
          height: barH,
          borderRadius: 2.5,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: barW,
          height: barH,
          borderRadius: 2.5,
          backgroundColor: color,
          transform: [{ rotate: '60deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: barW,
          height: barH,
          borderRadius: 2.5,
          backgroundColor: color,
          transform: [{ rotate: '120deg' }],
        }}
      />
      {/* Central circular hub */}
      <View
        style={{
          position: 'absolute',
          width: outerR * 2,
          height: outerR * 2,
          borderRadius: outerR,
          backgroundColor: color,
        }}
      />
      {/* Central hole cutout */}
      <View
        style={{
          position: 'absolute',
          width: innerR * 2,
          height: innerR * 2,
          borderRadius: innerR,
          backgroundColor: '#0F1322',
        }}
      />
    </View>
  );
};

/**
 * Filter Icon (Two funnel bars)
 */
export const IconFilter: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 14,
}) => {
  return (
    <View style={[styles.center, { width: size, height: size, gap: 2.5 }]}>
      <View style={{ width: size, height: 1.6, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: size * 0.65, height: 1.6, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: size * 0.35, height: 1.6, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
};

/**
 * Upward Trend / Income Icon
 */
export const IconIncome: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 18,
}) => {
  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
        },
      ]}
    >
      <View style={{ width: 7, height: 1.6, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
};

/**
 * Recurring / Repeat Arrows Icon
 */
export const IconRecurring: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 18,
}) => {
  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
          borderStyle: 'dashed',
        },
      ]}
    />
  );
};

/**
 * Modern Wallet Icon
 * Minimalist monochrome wallet with flap and clasp dot.
 */
export const IconWallet: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 20,
}) => {
  const width = size;
  const height = Math.round(size * 0.76);

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width,
          height,
          borderRadius: 4,
          borderWidth: 1.6,
          borderColor: color,
          justifyContent: 'center',
          overflow: 'visible',
        }}
      >
        {/* Wallet clasp/flap on the right */}
        <View
          style={{
            position: 'absolute',
            right: -2,
            width: Math.round(size * 0.36),
            height: Math.round(size * 0.42),
            borderTopLeftRadius: 3,
            borderBottomLeftRadius: 3,
            borderWidth: 1.6,
            borderRightWidth: 0,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
        >
          {/* Inner clasp dot */}
          <View
            style={{
              width: 3,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: color,
            }}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
