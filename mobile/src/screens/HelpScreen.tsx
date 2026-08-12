import React from "react";
import { View, Text, StyleSheet, Linking, Pressable } from "react-native";
import { Screen, Card } from "../components/UI";
import { colors, spacing } from "../theme/theme";

const FAQS = [
  {
    q: "How often should I run a website audit?",
    a: "Once a week is a good baseline, or right after you publish new content or make site changes.",
  },
  {
    q: "What does the SEO Score mean?",
    a: "It's a 0–100 summary of your site's overall health, combining audit results, keyword coverage, and performance.",
  },
  {
    q: "Can I track more than one website?",
    a: "Yes — add additional sites from the Projects tab.",
  },
  {
    q: "How do I change my password?",
    a: "Password changes aren't available in-app yet — contact support below and we'll help you reset it.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <View style={styles.faqItem}>
      <Text style={styles.faqQ}>{q}</Text>
      <Text style={styles.faqA}>{a}</Text>
    </View>
  );
}

export default function HelpScreen() {
  function handleContact() {
    Linking.openURL("mailto:info@lumexalliance.com?subject=Cem SEO Support Request");
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={styles.title}>Help & Support</Text>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          {FAQS.map((item, i) => (
            <React.Fragment key={item.q}>
              <FAQItem q={item.q} a={item.a} />
              {i < FAQS.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </Card>

        <Card>
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactDescription}>
            Reach out and we'll get back to you as soon as we can.
          </Text>
          <Pressable style={styles.contactButton} onPress={handleContact}>
            <Text style={styles.contactButtonText}>Email Support</Text>
          </Pressable>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  faqItem: { padding: spacing.lg, gap: 6 },
  faqQ: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  faqA: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  separator: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: spacing.lg },
  contactTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  contactDescription: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: spacing.md },
  contactButton: {
    backgroundColor: colors.bg,
    borderColor: colors.purple,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  contactButtonText: { color: colors.purple, fontSize: 13, fontWeight: "700" },
});
