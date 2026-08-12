import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, GradientButton } from "../components/UI";
import { colors, gradient, spacing } from "../theme/theme";

export default function OnboardingScreen({ navigation }: any) {
  return (
    <Screen style={styles.container}>
      <View style={styles.top}>
        <LinearGradient colors={gradient as unknown as string[]} style={styles.logo}>
          <Text style={styles.logoText}>C</Text>
        </LinearGradient>

        <View style={styles.headlineBlock}>
          <Text style={styles.wordmark}>Cem SEO</Text>
          <Text style={styles.headline}>Smarter SEO.</Text>
          <Text style={[styles.headline, styles.headlineAccent]}>Stronger Rankings.</Text>
          <Text style={styles.subtext}>
            All-in-one SEO platform to analyze, optimize and outrank your competition with
            data-driven insights.
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <GradientButton title="Get Started  →" onPress={() => navigation.navigate("Signup")} />

        <View style={styles.signInRow}>
          <Text style={styles.mutedText}>Already have an account? </Text>
          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text style={styles.linkText}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "space-between", paddingTop: 90, paddingBottom: 40 },
  top: { alignItems: "center" },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  logoText: { color: colors.white, fontSize: 34, fontWeight: "700" },
  headlineBlock: { alignItems: "center", marginTop: 48, gap: 6 },
  wordmark: { color: colors.ink, fontSize: 26, fontWeight: "700" },
  headline: { color: colors.ink, fontSize: 26, fontWeight: "700", textAlign: "center" },
  headlineAccent: { color: colors.purple },
  subtext: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 19,
  },
  bottom: { gap: spacing.lg },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.cardBorder },
  dotActive: { backgroundColor: colors.purple },
  signInRow: { flexDirection: "row", justifyContent: "center" },
  mutedText: { color: colors.textMuted, fontSize: 12 },
  linkText: { color: colors.purple, fontSize: 12, fontWeight: "600" },
});
