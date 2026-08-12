import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, GradientButton } from "../components/UI";
import { colors, spacing } from "../theme/theme";
import { api } from "../api/client";

type ProjectDetail = {
  id: number;
  domain: string;
  status: string;
  seoScore: number;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  backlinks: number;
  lastAuditAt: string;
  isActive: boolean;
  latestAudit: { healthScore: number; criticalIssues: number; warnings: number; notices: number; passedChecks: number } | null;
};

function statusColor(status: string) {
  if (status === "Critical") return colors.red;
  if (status === "Needs attention") return colors.amber;
  return colors.green;
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProjectDetailScreen({ route, navigation }: any) {
  const { projectId } = route.params;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getProject(projectId);
      setProject(res);
    } catch (err: any) {
      setError(err.message || "Couldn't load this project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSetActive() {
    if (!project) return;
    setSwitching(true);
    try {
      await api.setActiveProject(project.id);
      await load();
      Alert.alert("Switched", `Home, Audit, and Keywords now show ${project.domain}.`);
    } catch (err: any) {
      Alert.alert("Couldn't switch", err.message || "Something went wrong.");
    } finally {
      setSwitching(false);
    }
  }

  function handleDelete() {
    if (!project) return;
    Alert.alert(
      "Remove this site?",
      `${project.domain} and all its audit/keyword history will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteProject(project.id);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert("Couldn't delete", err.message || "Something went wrong.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.purple} />
      </Screen>
    );
  }

  if (error || !project) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.mutedText}>{error || "Project not found"}</Text>
      </Screen>
    );
  }

  const color = statusColor(project.status);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.title}>{project.domain}</Text>
            {project.isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { borderColor: color }]}>
            <Text style={[styles.statusText, { color }]}>{project.status}</Text>
          </View>
        </View>

        {!project.isActive && (
          <GradientButton
            title={switching ? "Switching…" : "Set as Active Site"}
            onPress={handleSetActive}
            loading={switching}
          />
        )}

        <Card>
          <Text style={styles.cardLabel}>SEO Score</Text>
          <Text style={[styles.bigScore, { color }]}>{project.seoScore}</Text>
          <Text style={styles.mutedText}>
            {project.lastAuditAt ? `Last audit: ${new Date(project.lastAuditAt).toLocaleDateString()}` : "No audits run yet"}
          </Text>
        </Card>

        <View style={styles.statsGrid}>
          <StatBlock label="Total Clicks" value={project.totalClicks.toLocaleString()} />
          <StatBlock label="Impressions" value={project.totalImpressions.toLocaleString()} />
          <StatBlock label="Avg. Position" value={project.avgPosition.toFixed(1)} />
          <StatBlock label="Backlinks" value={project.backlinks.toLocaleString()} />
        </View>

        {project.latestAudit && (
          <Card>
            <Text style={styles.cardLabel}>Latest Audit Summary</Text>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Critical Issues</Text>
              <Text style={[styles.auditValue, { color: colors.red }]}>{project.latestAudit.criticalIssues}</Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Warnings</Text>
              <Text style={[styles.auditValue, { color: colors.amber }]}>{project.latestAudit.warnings}</Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Passed Checks</Text>
              <Text style={[styles.auditValue, { color: colors.green }]}>{project.latestAudit.passedChecks}</Text>
            </View>
          </Card>
        )}

        <Text style={styles.deleteLink} onPress={handleDelete}>
          Remove this site
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  activeBadge: { backgroundColor: "rgba(103,106,246,0.18)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  activeBadgeText: { color: colors.purple, fontSize: 9, fontWeight: "700" },
  statusBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  bigScore: { fontSize: 40, fontWeight: "700", marginVertical: 6 },
  mutedText: { color: colors.textMuted, fontSize: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statBlock: {
    width: "47%",
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
  },
  statValue: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  auditRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  auditLabel: { color: colors.ink, fontSize: 13 },
  auditValue: { fontSize: 13, fontWeight: "700" },
  deleteLink: { color: colors.red, fontSize: 13, textAlign: "center", fontWeight: "600" },
});
