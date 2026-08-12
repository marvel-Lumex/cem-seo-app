import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, Pressable } from "react-native";
import { Screen, GradientButton } from "../components/UI";
import { colors, spacing, radius } from "../theme/theme";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function VerifyEmailScreen() {
  const { user, refreshUser, logout } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert("Enter the code", "The verification code is 6 digits.");
      return;
    }
    setLoading(true);
    try {
      await api.verifyEmail(code);
      await refreshUser();
    } catch (err: any) {
      Alert.alert("Couldn't verify", err.message || "That code didn't work.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await api.resendCode();
      Alert.alert("Code sent", "Check your email (or the backend console if SMTP isn't configured yet).");
    } catch (err: any) {
      Alert.alert("Couldn't resend", err.message || "Something went wrong.");
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen style={styles.container}>
      <View style={{ marginTop: 80 }}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {user?.email}. Enter it below to activate your account.
        </Text>
      </View>

      <View style={{ marginTop: 40 }}>
        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
        />
      </View>

      <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
        <GradientButton title="Verify" onPress={handleVerify} loading={loading} />
        <Pressable onPress={handleResend} disabled={resending}>
          <Text style={styles.linkText}>{resending ? "Sending…" : "Resend code"}</Text>
        </Pressable>
        <Pressable onPress={logout}>
          <Text style={styles.mutedText}>Sign out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "space-between", paddingBottom: 60 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 8, lineHeight: 19 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 18,
    color: colors.ink,
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: "700",
  },
  linkText: { color: colors.purple, fontSize: 13, fontWeight: "600", textAlign: "center" },
  mutedText: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
});
