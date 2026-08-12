import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { Screen, Card, GradientButton } from "../components/UI";
import { colors, spacing, radius } from "../theme/theme";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function ProfileScreen({ navigation }: any) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a name.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.updateProfile(name.trim());
      setUser(res.user);
      Alert.alert("Saved", "Your profile has been updated.");
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.lg, gap: spacing.lg }}>
        <Text style={styles.title}>Profile</Text>

        <Card style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textMuted} />
          </View>
          <View>
            <Text style={styles.label}>Email</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyText}>{user?.email}</Text>
            </View>
            <Text style={styles.helperText}>Email can't be changed from here yet.</Text>
          </View>
        </Card>

        <GradientButton title="Save Changes" onPress={handleSave} loading={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
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
  readonlyField: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  readonlyText: { color: colors.textMuted, fontSize: 14 },
  helperText: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
