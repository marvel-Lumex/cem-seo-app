import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Card, GradientButton } from "../components/UI";
import { ScoreRing } from "../components/ScoreRing";
import { TrendSparkline } from "../components/TrendSparkline";
import { colors, spacing, radius, gradient } from "../theme/theme";
import { api } from "../api/client";

type CategoryScores = { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null };
type TopIssue = { title: string; score: number };
type HistoryPoint = { healthScore: number; runAt: string };

type AuditData = {
  healthScore: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  passedChecks: number;
  topIssues: TopIssue[];
  categoryScores: CategoryScores | null;
};

function SummaryRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryLeft}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <View style={styles.summaryRight}>
        <Text style={styles.summaryCount}>{count}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </View>
  );
}

function CategoryPill({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const color = score >= 90 ? colors.green : score >= 50 ? colors.amber : colors.red;
  return (
    <View style={styles.categoryPill}>
      <Text style={[styles.categoryScore, { color }]}>{score}</Text>
      <Text style={styles.categoryLabel}>{label}</Text>
    </View>
  );
}

function healthTag(score: number) {
  if (score >= 80) return { label: "Excellent", color: colors.green };
  if (score >= 60) return { label: "Good", color: colors.green };
  if (score >= 40) return { label: "Needs work", color: colors.amber };
  return { label: "Critical", color: colors.red };
}

export default function AuditScreen() {
  const [data, setData] = useState<AuditData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getAudit();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
    try {
      const hist = await api.getAuditHistory();
      setHistory(hist);
    } catch {
      setHistory([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRunAudit() {
    setRunning(true);
    try {
      const res = await api.runAudit();
      setData(res);
      const hist = await api.getAuditHistory();
      setHistory(hist);
    } catch (err: any) {
      Alert.alert("Audit failed", err.message || "Something went wrong running the audit.");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.purple} />
      </Screen>
    );
  }

  const tag = data ? healthTag(data.healthScore) : { label: "—", color: colors.textMuted };
  const trendDelta = history.length >= 2 ? history[history.length - 1].healthScore - history[0].healthScore : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.introCard}>
          <LinearGradient colors={gradient as unknown as string[]} style={styles.introIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Website Audit</Text>
            <Text style={styles.introSub}>
              Real data from Google PageSpeed Insights — performance, accessibility, best practices, and SEO.
            </Text>
          </View>
        </Card>

        <Card style={styles.healthCard}>
          <ScoreRing score={data?.healthScore ?? 0} size={100} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.cardLabel}>Overall Health Score</Text>
            <Text style={[styles.healthTag, { color: tag.color }]}>{tag.label}</Text>
            <Text style={styles.introSub}>
              {data
                ? data.healthScore >= 60
                  ? "Your site is healthy but has room to improve."
                  : "Your site needs attention — see the summary below."
                : "Run an audit to see how your site is doing."}
            </Text>
          </View>
        </Card>

        {history.length >= 2 && (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
              <Text style={styles.cardLabel}>Score Trend ({history.length} audits)</Text>
              {trendDelta !== null && (
                <Text style={[styles.trendDelta, { color: trendDelta >= 0 ? colors.green : colors.red }]}>
                  {trendDelta >= 0 ? "▲" : "▼"} {Math.abs(trendDelta)}
                </Text>
              )}
            </View>
            <TrendSparkline data={history} width={300} height={60} />
          </Card>
        )}

        {data?.categoryScores && (
          <View style={styles.categoriesRow}>
            <CategoryPill label="Performance" score={data.categoryScores.performance} />
            <CategoryPill label="Accessibility" score={data.categoryScores.accessibility} />
            <CategoryPill label="Best Practices" score={data.categoryScores.bestPractices} />
            <CategoryPill label="SEO" score={data.categoryScores.seo} />
          </View>
        )}

        {data && (
          <Card>
            <View style={styles.summaryHeader}>
              <Text style={styles.sectionTitle}>Audit Summary</Text>
            </View>
            <SummaryRow label="Critical Issues" count={data.criticalIssues} color={colors.red} />
            <SummaryRow label="Warnings" count={data.warnings} color={colors.amber} />
            <SummaryRow label="Notices" count={data.notices} color={colors.blue} />
            <SummaryRow label="Passed Checks" count={data.passedChecks} color={colors.green} />
          </Card>
        )}

        {data && data.topIssues.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Top Issues to Fix</Text>
            {data.topIssues.slice(0, 6).map((issue, i) => (
              <View key={issue.title} style={i > 0 ? styles.issueRow : styles.issueRowFirst}>
                <Text style={styles.issueText} numberOfLines={2}>
                  {issue.title}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <GradientButton
          title={running ? "Running Audit… (up to 30s)" : "Run New Audit  ↻"}
          onPress={handleRunAudit}
          loading={running}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  introCard: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  introIcon: { width: 48, height: 48, borderRadius: radius.sm },
  introTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  introSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  healthCard: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  healthTag: { fontSize: 16, fontWeight: "700" },
  trendDelta: { fontSize: 13, fontWeight: "700" },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  summaryHeader: { marginBottom: spacing.sm },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  summaryLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { color: colors.ink, fontSize: 13 },
  summaryRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryCount: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chevron: { color: colors.textMuted, fontSize: 14 },
  categoriesRow: { flexDirection: "row", gap: spacing.sm },
  categoryPill: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  categoryScore: { fontSize: 18, fontWeight: "700" },
  categoryLabel: { color: colors.textMuted, fontSize: 9, marginTop: 2, textAlign: "center" },
  issueRowFirst: { paddingTop: spacing.sm },
  issueRow: { paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  issueText: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});
