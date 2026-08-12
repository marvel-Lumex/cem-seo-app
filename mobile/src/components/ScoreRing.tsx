import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors } from "../theme/theme";

type Props = {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
};

export function ScoreRing({ score, size = 110, strokeWidth = 10, label }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.purple} />
            <Stop offset="1" stopColor={colors.blue} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.cardBorder}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          fill="none"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.center}>
          <Text style={styles.scoreText}>{Math.round(score)}</Text>
          <Text style={styles.outOfText}>/100</Text>
          {label ? <Text style={styles.labelText}>{label}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scoreText: { color: colors.ink, fontSize: 26, fontWeight: "700" },
  outOfText: { color: colors.textMuted, fontSize: 10, marginTop: -2 },
  labelText: { color: colors.green, fontSize: 11, fontWeight: "600", marginTop: 4 },
});
