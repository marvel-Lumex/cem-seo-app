import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../components/UI";
import { colors, spacing, radius, gradient } from "../theme/theme";
import { api } from "../api/client";

type Project = { id: number; domain: string; status: string; seoScore: number; lastAuditAt: string; isActive: boolean };

function statusColor(status: string) {
  if (status === "Critical") return colors.red;
  if (status === "Needs attention") return colors.amber;
  return colors.green;
}

function ProjectCard({ item, onPress }: { item: Project; onPress: () => void }) {
  const color = statusColor(item.status);
  return (
    <Pressable
      style={[styles.card, item.isActive && styles.cardActive]}
      onPress={onPress}
      android_ripple={{ color: colors.cardBorder }}
    >
      <View style={styles.cardLeft}>
        <LinearGradient colors={gradient as unknown as string[]} style={styles.favicon} />
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.domain}>{item.domain}</Text>
            {item.isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta}>
            {item.lastAuditAt ? `Last audit: ${new Date(item.lastAuditAt).toLocaleDateString()}` : "No audits yet"}
          </Text>
        </View>
      </View>
      <View style={[styles.scoreBadge, { borderColor: color }]}>
        <Text style={[styles.scoreText, { color }]}>{item.seoScore}</Text>
      </View>
    </Pressable>
  );
}

export default function ProjectsScreen({ navigation }: any) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.getProjects();
      setProjects(res);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.subtitle}>
            {projects.length} site{projects.length === 1 ? "" : "s"} tracked. Tap one to switch which site Home, Audit, and Keywords show.
          </Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate("AddProject")}>
          <LinearGradient colors={gradient as unknown as string[]} style={styles.addButtonGradient}>
            <Text style={styles.addButtonText}>+</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProjectCard
              item={item}
              onPress={() => navigation.navigate("ProjectDetail", { projectId: item.id, domain: item.domain })}
            />
          )}
          contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xxl }}
          ListEmptyComponent={
            <Text style={styles.subtitle}>No projects yet — tap + to add your first site.</Text>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: spacing.lg,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2, maxWidth: 260, lineHeight: 16 },
  addButton: {},
  addButtonGradient: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: colors.white, fontSize: 18, fontWeight: "700" },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  cardActive: { borderColor: colors.purple },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  favicon: { width: 38, height: 38, borderRadius: 10 },
  domain: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  activeBadge: { backgroundColor: "rgba(103,106,246,0.18)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  activeBadgeText: { color: colors.purple, fontSize: 9, fontWeight: "700" },
  scoreBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  scoreText: { fontSize: 12, fontWeight: "700" },
});
