import React from 'react';
import { View, StyleSheet } from 'react-native';

interface IconProps {
  color: string;
  size?: number;
  focused?: boolean;
}

/**
 * Modern 4-Tile Dashboard / Overview Icon (Linear / Notion / Apple style)
 * Strictly monochrome, no emojis.
 */
export const IconOverview: React.FC<IconProps> = ({
  color,
  size = 20,
  focused = false,
}) => {
  const tileSize = Math.round(size * 0.36);
  const gap = Math.round(size * 0.14);

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={{ flexDirection: 'row', gap }}>
        <View
          style={{
            width: tileSize,
            height: tileSize,
            borderRadius: 2,
            borderWidth: focused ? 0 : 1.6,
            borderColor: color,
            backgroundColor: focused ? color : 'transparent',
          }}
        />
        <View
          style={{
            width: tileSize,
            height: tileSize,
            borderRadius: 2,
            borderWidth: focused ? 0 : 1.6,
            borderColor: color,
            backgroundColor: focused ? color : 'transparent',
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: gap }}>
        <View
          style={{
            width: tileSize,
            height: tileSize,
            borderRadius: 2,
            borderWidth: focused ? 0 : 1.6,
            borderColor: color,
            backgroundColor: focused ? color : 'transparent',
          }}
        />
        <View
          style={{
            width: tileSize,
            height: tileSize,
            borderRadius: 2,
            borderWidth: focused ? 0 : 1.6,
            borderColor: color,
            backgroundColor: focused ? color : 'transparent',
          }}
        />
      </View>
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
 * Modern iOS/macOS Preferences Sliders Icon
 * Strictly monochrome, no emojis.
 */
export const IconSettings: React.FC<IconProps> = ({
  color,
  size = 20,
  focused = false,
}) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: 'center',
        gap: 4.5,
      }}
    >
      {/* Track 1 with knob at 25% */}
      <View style={{ height: 6, justifyContent: 'center' }}>
        <View style={{ height: 1.6, width: '100%', backgroundColor: color, borderRadius: 1 }} />
        <View
          style={{
            position: 'absolute',
            left: 2.5,
            width: 5.5,
            height: 5.5,
            borderRadius: 2,
            backgroundColor: focused ? color : '#FFFFFF',
            borderWidth: 1.6,
            borderColor: color,
          }}
        />
      </View>
      {/* Track 2 with knob at 75% */}
      <View style={{ height: 6, justifyContent: 'center' }}>
        <View style={{ height: 1.6, width: '100%', backgroundColor: color, borderRadius: 1 }} />
        <View
          style={{
            position: 'absolute',
            right: 2.5,
            width: 5.5,
            height: 5.5,
            borderRadius: 2,
            backgroundColor: focused ? color : '#FFFFFF',
            borderWidth: 1.6,
            borderColor: color,
          }}
        />
      </View>
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

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
