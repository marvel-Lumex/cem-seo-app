import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { Screen, Card, GradientButton } from "../components/UI";
import { colors, spacing, radius } from "../theme/theme";
import { api } from "../api/client";

function normalizeDomainInput(raw: string) {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/\/.*$/, "");
  return d;
}

function isValidDomain(domain: string) {
  // Simple sanity check — real validation happens when the site is actually audited
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain);
}

export default function AddProjectScreen({ navigation }: any) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    const cleaned = normalizeDomainInput(domain);
    if (!cleaned || !isValidDomain(cleaned)) {
      Alert.alert("Invalid domain", "Enter a real domain, like example.com — no need for https:// or www.");
      return;
    }

    setLoading(true);
    try {
      const project = await api.createProject(cleaned);
      Alert.alert("Site added", `${cleaned} is now your active site — Home, Audit, and Keywords will show its data.`, [
        {
          text: "View it",
          onPress: () =>
            navigation.replace("ProjectDetail", { projectId: project.id, domain: project.domain }),
        },
      ]);
    } catch (err: any) {
      Alert.alert("Couldn't add site", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={styles.title}>Add a website</Text>
          <Text style={styles.subtitle}>Enter the domain you want to track — we'll start auditing it right away.</Text>
        </View>

        <Card style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.label}>Domain</Text>
            <TextInput
              style={styles.input}
              placeholder="example.com"
              placeholderTextColor={colors.textMuted}
              value={domain}
              onChangeText={setDomain}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={styles.helperText}>No need for "https://" or "www." — just the domain.</Text>
          </View>
        </Card>

        <GradientButton title="Add Website" onPress={handleAdd} loading={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 14,
  },
  helperText: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
});
