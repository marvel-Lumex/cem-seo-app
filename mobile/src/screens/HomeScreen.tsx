import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card } from "../components/UI";
import { ScoreRing } from "../components/ScoreRing";
import { colors, spacing, radius } from "../theme/theme";
import { api } from "../api/client";

type DashboardData = {
  domain: string;
  seoScore: number;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  backlinks: number;
};

const METRIC_INFO: Record<string, string> = {
  "Total Clicks": "How many times people clicked through to your site from search results this period.",
  "Impressions": "How many times your site appeared in search results, whether or not it was clicked.",
  "Avg. Position": "Your average ranking position across all tracked keywords — lower is better (1 = top result).",
  "Backlinks": "The number of other websites linking back to yours — a key ranking signal for SEO.",
};

function StatCard({
  label,
  value,
  delta,
  positive,
}: {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}) {
  function handlePress() {
    Alert.alert(label, `${value}\n\n${METRIC_INFO[label] || ""}`);
  }
  return (
    <Pressable style={{ flex: 1 }} onPress={handlePress} android_ripple={{ color: colors.cardBorder }}>
      <Card style={styles.statCard}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={[styles.statDelta, { color: positive ? colors.green : colors.red }]}>
          {positive ? "▲" : "▼"} {delta}
        </Text>
      </Card>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }: any) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Couldn't load your dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.purple} />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.mutedText}>{error || "No data yet"}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.purple} />}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.subtitle}>Here's your SEO performance overview.</Text>
        </View>

        <Pressable onPress={() => navigation.navigate("Projects")} android_ripple={{ color: colors.cardBorder }}>
          <View style={styles.domainPill}>
            <Text style={styles.domainText}>🌐  {data.domain}  ▾</Text>
          </View>
        </Pressable>

        <View style={{ flexDirection: "row" }}>
          <View style={[styles.dataSourceBadge, data.isLiveData ? styles.liveBadge : styles.sampleBadge]}>
            <Text style={[styles.dataSourceText, { color: data.isLiveData ? colors.green : colors.textMuted }]}>
              {data.isLiveData ? "● Live data from Search Console" : "○ Sample data — connect Search Console in More"}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => navigation.navigate("Audit")} android_ripple={{ color: colors.cardBorder }}>
          <Card>
            <Text style={styles.cardLabel}>SEO Score — tap for full audit</Text>
            <View style={{ alignItems: "center", marginVertical: spacing.md }}>
              <ScoreRing score={data.seoScore} label={data.seoScore >= 80 ? "Excellent ↗" : data.seoScore >= 60 ? "Good ↗" : "Needs work"} />
            </View>
          </Card>
        </Pressable>

        <View style={styles.statsRow}>
          <StatCard label="Total Clicks" value={data.totalClicks.toLocaleString()} delta="18%" positive />
          <StatCard label="Impressions" value={data.totalImpressions.toLocaleString()} delta="22%" positive />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Avg. Position" value={data.avgPosition.toFixed(1)} delta="2.4" positive={false} />
          <StatCard label="Backlinks" value={data.backlinks.toLocaleString()} delta="9%" positive />
        </View>

        <Card>
          <Text style={styles.cardLabel}>Performance Overview — Last 30 Days</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.mutedText}>Chart data coming soon</Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  welcome: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  domainPill: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  domainText: { color: colors.ink, fontSize: 13, fontWeight: "500" },
  dataSourceBadge: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  liveBadge: { backgroundColor: "rgba(94,214,140,0.12)" },
  sampleBadge: { backgroundColor: "rgba(255,255,255,0.03)" },
  dataSourceText: { fontSize: 11, fontWeight: "600" },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: spacing.md },
  statCard: { gap: 6 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  statValue: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  statDelta: { fontSize: 11, fontWeight: "600" },
  chartPlaceholder: {
    height: 100,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  mutedText: { color: colors.textMuted, fontSize: 12 },
});
