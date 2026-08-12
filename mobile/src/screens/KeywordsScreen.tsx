import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, Pressable, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Card, Pill } from "../components/UI";
import { TrendSparkline } from "../components/TrendSparkline";
import { colors, spacing, radius, gradient } from "../theme/theme";
import { api } from "../api/client";

type Keyword = { keyword: string; volume: string; difficulty: number };
type Trends = {
  keyword: string;
  interestOverTime: { date: string; value: number }[];
  relatedQueries: { top: string[]; rising: string[] };
};

function kdColor(kd: number) {
  if (kd < 30) return colors.green;
  if (kd < 45) return colors.amber;
  return colors.red;
}

function difficultyLabel(kd: number) {
  if (kd < 30) return "Easy — a good target for newer sites";
  if (kd < 45) return "Moderate — achievable with solid on-page SEO";
  return "Hard — established competitors dominate this term";
}

function KeywordRow({ item }: { item: Keyword }) {
  function handlePress() {
    Alert.alert(
      item.keyword,
      `Monthly search volume: ${item.volume}\nKeyword Difficulty: ${item.difficulty}/100\n\n${difficultyLabel(item.difficulty)}`
    );
  }
  return (
    <Pressable style={styles.row} onPress={handlePress} android_ripple={{ color: colors.cardBorder }}>
      <Text style={styles.keyword} numberOfLines={1}>
        {item.keyword}
      </Text>
      <View style={styles.rowRight}>
        <Text style={styles.volume}>{item.volume}</Text>
        <View style={[styles.kdBadge, { borderColor: kdColor(item.difficulty) }]}>
          <Text style={[styles.kdText, { color: kdColor(item.difficulty) }]}>{item.difficulty}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function TrendingPanel({ trends, loading, onPickQuery }: { trends: Trends | null; loading: boolean; onPickQuery: (q: string) => void }) {
  if (loading) {
    return (
      <Card>
        <ActivityIndicator color={colors.purple} />
      </Card>
    );
  }
  if (!trends) return null;

  const hasData = trends.interestOverTime.length > 0 || trends.relatedQueries.top.length > 0 || trends.relatedQueries.rising.length > 0;
  if (!hasData) return null;

  return (
    <Card>
      <Text style={styles.trendingTitle}>📈 Real Google Trends — "{trends.keyword}"</Text>

      {trends.interestOverTime.length >= 2 && (
        <View style={{ marginTop: spacing.sm, alignItems: "center" }}>
          <TrendSparkline
            data={trends.interestOverTime.map((p) => ({ healthScore: p.value, runAt: p.date }))}
            width={280}
            height={50}
          />
          <Text style={styles.trendingCaption}>Search interest over the last 12 months (100 = peak popularity)</Text>
        </View>
      )}

      {trends.relatedQueries.rising.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={styles.chipGroupLabel}>🔥 Rising searches</Text>
          <View style={styles.chipRow}>
            {trends.relatedQueries.rising.map((q) => (
              <Pressable key={q} style={styles.chip} onPress={() => onPickQuery(q)}>
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {trends.relatedQueries.top.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={styles.chipGroupLabel}>Related searches</Text>
          <View style={styles.chipRow}>
            {trends.relatedQueries.top.map((q) => (
              <Pressable key={q} style={styles.chip} onPress={() => onPickQuery(q)}>
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

export default function KeywordsScreen() {
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);

  const load = useCallback(async (q?: string) => {
    try {
      const res = await api.getKeywords(q);
      setKeywords(res);
    } catch {
      setKeywords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Debounced search-as-you-type, plus real Google Trends lookup for the same term
  useEffect(() => {
    const handle = setTimeout(async () => {
      load(query || undefined);

      const term = query.trim();
      if (term.length < 2) {
        setTrends(null);
        return;
      }
      setTrendsLoading(true);
      try {
        const res = await api.getKeywordTrends(term);
        setTrends(res);
      } catch {
        setTrends(null);
      } finally {
        setTrendsLoading(false);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [query, load]);

  return (
    <Screen>
      <FlatList
        data={keywords}
        keyExtractor={(item) => item.keyword}
        renderItem={({ item }) => <KeywordRow item={item} />}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Card style={styles.introCard}>
              <LinearGradient colors={gradient as unknown as string[]} style={styles.introIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.introTitle}>Keyword Research</Text>
                <Text style={styles.introSub}>Find high-value keywords to rank higher and drive more traffic.</Text>
              </View>
            </Card>

            <TextInput
              style={styles.searchInput}
              placeholder="Search keyword or topic..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />

            {(trendsLoading || trends) && (
              <TrendingPanel trends={trends} loading={trendsLoading} onPickQuery={setQuery} />
            )}

            <View style={styles.pillsRow}>
              <Pill label="All" active />
              <Pill label="Questions" />
              <Pill label="Broad Match" />
            </View>

            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Keyword</Text>
              <Text style={styles.tableHeaderText}>Volume   KD</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
          ) : (
            <Text style={[styles.introSub, { textAlign: "center", marginTop: spacing.lg }]}>No keywords found.</Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  introCard: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  introIcon: { width: 48, height: 48, borderRadius: radius.sm },
  introTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  introSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  searchInput: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 13,
  },
  trendingTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  trendingCaption: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  chipGroupLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipText: { color: colors.ink, fontSize: 11 },
  pillsRow: { flexDirection: "row", gap: spacing.sm },
  tableHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  tableHeaderText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  keyword: { color: colors.ink, fontSize: 13, flex: 1, marginRight: spacing.sm },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  volume: { color: colors.textMuted, fontSize: 12, fontWeight: "500" },
  kdBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  kdText: { fontSize: 11, fontWeight: "700" },
  separator: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: spacing.md },
});
