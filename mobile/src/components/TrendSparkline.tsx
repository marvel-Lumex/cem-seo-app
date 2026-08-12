import React from "react";
import { View } from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { colors } from "../theme/theme";

type Point = { healthScore: number; runAt: string };

export function TrendSparkline({ data, width = 300, height = 60 }: { data: Point[]; width?: number; height?: number }) {
  if (data.length < 2) return null;

  const scores = data.map((d) => d.healthScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const padding = 6;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((d.healthScore - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Polyline points={polylinePoints} fill="none" stroke={colors.purple} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={last.x} cy={last.y} r={4} fill={colors.purple} />
      </Svg>
    </View>
  );
}
