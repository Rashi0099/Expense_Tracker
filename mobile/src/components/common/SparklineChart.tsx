/**
 * SparklineChart — Pure React Native area chart (no external lib)
 * Renders connected line segments between data points with gradient fill effect.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

interface SparklineChartProps {
  data: number[];
  width: number;
  height: number;
  lineColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}

export const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  width,
  height,
  lineColor = '#D99A27',
  fillColor = 'rgba(217,154,39,0.15)',
  strokeWidth = 2.5,
}) => {
  const segments = useMemo(() => {
    if (!data || data.length < 2) return [];

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = strokeWidth;
    const chartH = height - padding * 2;
    const stepX = width / (data.length - 1);

    // Normalize to pixel coords (Y flipped: 0 at bottom)
    const points = data.map((v, i) => ({
      x: i * stepX,
      y: padding + chartH - ((v - min) / range) * chartH,
    }));

    // Build line segments
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Fill trapezoid below the line segment
      const fillHeight = Math.max(height - p1.y, height - p2.y);
      segs.push({ p1, p2, dx, dy, length, angle, fillHeight });
    }

    return segs;
  }, [data, width, height, strokeWidth]);

  if (!data || data.length < 2) return null;

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      {segments.map((seg, i) => {
        // Render fill below each segment as a tall rectangle rotated with the line
        const fillH = Math.max(height - seg.p1.y, height - seg.p2.y) + 4;
        return (
          <React.Fragment key={i}>
            {/* Fill area below the line segment */}
            <View
              style={[
                styles.fillSegment,
                {
                  left: seg.p1.x,
                  top: Math.min(seg.p1.y, seg.p2.y),
                  width: Math.abs(seg.dx) + 1,
                  height: fillH,
                  backgroundColor: fillColor,
                },
              ]}
            />
            {/* Line segment */}
            <View
              style={[
                styles.lineSegment,
                {
                  left: seg.p1.x,
                  top: seg.p1.y - strokeWidth / 2,
                  width: seg.length,
                  height: strokeWidth,
                  backgroundColor: lineColor,
                  transform: [{ rotate: `${seg.angle}deg` }],
                  transformOrigin: '0 50%',
                },
              ]}
            />
          </React.Fragment>
        );
      })}
      {/* Dot at last point */}
      {(() => {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const chartH = height - strokeWidth * 2;
        const lastY = strokeWidth + chartH - ((data[data.length - 1] - min) / range) * chartH;
        const lastX = width;
        return (
          <View
            style={[
              styles.dot,
              {
                left: lastX - 5,
                top: lastY - 5,
                backgroundColor: lineColor,
                borderColor: 'rgba(255,255,255,0.9)',
              },
            ]}
          />
        );
      })()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  fillSegment: {
    position: 'absolute',
    opacity: 0.6,
  },
  lineSegment: {
    position: 'absolute',
    borderRadius: 2,
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
