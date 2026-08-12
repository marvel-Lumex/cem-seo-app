import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Screen, Card } from "../components/UI";
import { colors, spacing } from "../theme/theme";
import { useAuth } from "../context/AuthContext";

function MenuRow({ label, onPress, destructive }: { label: string; onPress?: () => void; destructive?: boolean }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={[styles.rowLabel, destructive && { color: colors.red }]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function MoreScreen({ navigation }: any) {
  const { logout, user } = useAuth();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={styles.title}>More</Text>
          {user?.name ? <Text style={styles.subtitle}>{user.name}</Text> : null}
        </View>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow label="Profile" onPress={() => navigation.navigate("Profile")} />
          <View style={styles.separator} />
          <MenuRow label="Google Search Console" onPress={() => navigation.navigate("SearchConsole")} />
          <View style={styles.separator} />
          <MenuRow label="Notifications" onPress={() => navigation.navigate("Notifications")} />
          <View style={styles.separator} />
          <MenuRow label="Billing" onPress={() => navigation.navigate("Billing")} />
          <View style={styles.separator} />
          <MenuRow label="Help & Support" onPress={() => navigation.navigate("Help")} />
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow label="Sign Out" destructive onPress={logout} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
  },
  rowLabel: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  chevron: { color: colors.textMuted, fontSize: 16 },
  separator: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: spacing.lg },
});
