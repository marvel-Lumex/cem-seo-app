import React from "react";
import { View, Text, StyleSheet, Alert, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Card } from "../components/UI";
import { colors, spacing, gradient } from "../theme/theme";

const PLANS = [
  { name: "Starter", price: "Free", features: ["1 project", "Weekly audits", "Basic keyword search"], current: true },
  { name: "Growth", price: "$29/mo", features: ["5 projects", "Daily audits", "Full keyword research", "Email support"], current: false },
  { name: "Agency", price: "$99/mo", features: ["Unlimited projects", "Real-time audits", "Priority support", "White-label reports"], current: false },
];

export default function BillingScreen() {
  function handleUpgrade(planName: string) {
    // Real payments need a Stripe (or similar) account connected on the
    // backend — see README "Billing / payments" section. Until then this
    // is a placeholder so the screen doesn't silently do nothing.
    Alert.alert(
      "Coming soon",
      `Upgrading to ${planName} isn't connected to payments yet. Contact support if you'd like early access.`
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <View>
          <Text style={styles.title}>Billing</Text>
          <Text style={styles.subtitle}>You're currently on the Starter plan.</Text>
        </View>

        {PLANS.map((plan) => (
          <Card key={plan.name} style={plan.current ? styles.currentCard : undefined}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
            </View>
            {plan.features.map((f) => (
              <Text key={f} style={styles.feature}>
                ✓ {f}
              </Text>
            ))}
            {plan.current ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current Plan</Text>
              </View>
            ) : (
              <Pressable onPress={() => handleUpgrade(plan.name)}>
                <LinearGradient colors={gradient as unknown as string[]} style={styles.upgradeButton}>
                  <Text style={styles.upgradeButtonText}>Upgrade to {plan.name}</Text>
                </LinearGradient>
              </Pressable>
            )}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  currentCard: { borderColor: colors.purple },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  planName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  planPrice: { color: colors.purple, fontSize: 14, fontWeight: "700" },
  feature: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  currentBadge: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    backgroundColor: "rgba(103,106,246,0.15)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  currentBadgeText: { color: colors.purple, fontSize: 11, fontWeight: "700" },
  upgradeButton: { marginTop: spacing.md, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  upgradeButtonText: { color: colors.white, fontSize: 13, fontWeight: "700" },
});
