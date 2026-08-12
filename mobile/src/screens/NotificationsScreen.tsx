import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Switch, ActivityIndicator } from "react-native";
import { Screen, Card } from "../components/UI";
import { colors, spacing } from "../theme/theme";
import { api } from "../api/client";

type Prefs = { emailNotifications: boolean; pushNotifications: boolean; weeklyReport: boolean };

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.cardBorder, true: colors.purple }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getNotificationPrefs();
        setPrefs(res);
      } catch {
        setPrefs({ emailNotifications: true, pushNotifications: true, weeklyReport: true });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function update(partial: Partial<Prefs>) {
    if (!prefs) return;
    const next = { ...prefs, ...partial };
    setPrefs(next);
    setSaving(true);
    try {
      await api.updateNotificationPrefs(next);
    } catch {
      // silently keep the optimistic UI state; a real app might toast an error here
    } finally {
      setSaving(false);
    }
  }

  if (loading || !prefs) {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.purple} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>Notifications</Text>
          {saving && <ActivityIndicator size="small" color={colors.textMuted} />}
        </View>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <ToggleRow
            label="Email notifications"
            description="Account activity and important updates"
            value={prefs.emailNotifications}
            onChange={(v) => update({ emailNotifications: v })}
          />
          <View style={styles.separator} />
          <ToggleRow
            label="Push notifications"
            description="Real-time alerts on your device"
            value={prefs.pushNotifications}
            onChange={(v) => update({ pushNotifications: v })}
          />
          <View style={styles.separator} />
          <ToggleRow
            label="Weekly report"
            description="A summary of your SEO performance every Monday"
            value={prefs.weeklyReport}
            onChange={(v) => update({ weeklyReport: v })}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  rowLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  rowDescription: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: spacing.lg },
});
