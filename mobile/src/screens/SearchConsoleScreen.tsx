import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Linking, Pressable, Alert, FlatList } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, GradientButton } from "../components/UI";
import { colors, spacing, radius } from "../theme/theme";
import { api } from "../api/client";

type Status = { configured: boolean; connected: boolean; siteUrl: string | null };
type Site = { siteUrl: string; permissionLevel: string };

export default function SearchConsoleScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getGscStatus();
      setStatus(res);
      if (res.connected && !res.siteUrl) {
        setLoadingSites(true);
        try {
          const s = await api.getGscSites();
          setSites(s);
        } catch {
          setSites([]);
        } finally {
          setLoadingSites(false);
        }
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await api.getGscAuthUrl();
      await Linking.openURL(res.url);
    } catch (err: any) {
      Alert.alert("Couldn't connect", err.message || "Something went wrong.");
    } finally {
      setConnecting(false);
    }
  }

  async function handlePickSite(siteUrl: string) {
    try {
      await api.setGscSite(siteUrl);
      await load();
      Alert.alert("Connected", "Your Home dashboard will now show real data from this site.");
    } catch (err: any) {
      Alert.alert("Couldn't select site", err.message || "Something went wrong.");
    }
  }

  function handleDisconnect() {
    Alert.alert("Disconnect Search Console?", "Your dashboard will go back to showing sample data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          await api.disconnectGsc();
          load();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.purple} />
      </Screen>
    );
  }

  if (!status?.configured) {
    return (
      <Screen>
        <View style={{ paddingTop: spacing.xl, gap: spacing.lg }}>
          <Text style={styles.title}>Google Search Console</Text>
          <Card>
            <Text style={styles.bodyText}>
              This isn't set up on the server yet. It needs a Google OAuth client ID and secret added to the
              backend's .env file — see the README section "Google Search Console" for the exact steps.
            </Text>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xl, gap: spacing.lg }}>
        <Text style={styles.title}>Google Search Console</Text>
        <Text style={styles.subtitle}>
          Connect your real Google Search Console account to show actual clicks, impressions, and position on
          your Home dashboard — instead of sample numbers.
        </Text>

        {!status.connected && (
          <>
            <GradientButton
              title={connecting ? "Opening…" : "Connect Google Search Console"}
              onPress={handleConnect}
              loading={connecting}
            />
            <Text style={styles.helperText}>
              This opens your browser to sign in with Google. Once approved, come back to this screen.
            </Text>
          </>
        )}

        {status.connected && !status.siteUrl && (
          <Card>
            <Text style={styles.cardLabel}>Choose which site to use</Text>
            {loadingSites ? (
              <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.md }} />
            ) : sites.length === 0 ? (
              <Text style={styles.bodyText}>
                No verified sites found in your Search Console account. Add and verify your site at
                search.google.com/search-console first.
              </Text>
            ) : (
              <FlatList
                data={sites}
                keyExtractor={(s) => s.siteUrl}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Pressable style={styles.siteRow} onPress={() => handlePickSite(item.siteUrl)}>
                    <Text style={styles.siteUrl} numberOfLines={1}>
                      {item.siteUrl}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                )}
              />
            )}
          </Card>
        )}

        {status.connected && status.siteUrl && (
          <Card>
            <Text style={styles.cardLabel}>Connected site</Text>
            <Text style={styles.bodyText}>{status.siteUrl}</Text>
            <Pressable onPress={handleDisconnect} style={{ marginTop: spacing.md }}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  cardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 8 },
  bodyText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  helperText: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  siteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  siteUrl: { color: colors.ink, fontSize: 13, flex: 1 },
  chevron: { color: colors.textMuted, fontSize: 16 },
  disconnectText: { color: colors.red, fontSize: 13, fontWeight: "600" },
});
