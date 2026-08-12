import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from "react-native";
import { Screen, GradientButton } from "../components/UI";
import { colors, spacing, radius } from "../theme/theme";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      Alert.alert("Couldn't sign in", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.container}>
      <View style={{ marginTop: 60 }}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to see your SEO performance.</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <View style={{ gap: spacing.lg }}>
        <GradientButton title="Sign In" onPress={handleLogin} loading={loading} />
        <Pressable style={styles.linkRow} onPress={() => navigation.navigate("Signup")}>
          <Text style={styles.mutedText}>Don't have an account? </Text>
          <Text style={styles.linkText}>Create one</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "space-between", paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  form: { gap: spacing.md, marginTop: 40 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 14,
  },
  linkRow: { flexDirection: "row", justifyContent: "center" },
  mutedText: { color: colors.textMuted, fontSize: 12 },
  linkText: { color: colors.purple, fontSize: 12, fontWeight: "600" },
});
