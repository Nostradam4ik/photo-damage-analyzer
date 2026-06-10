import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";

import { COLORS, FONT_SIZE, RADIUS } from "../constants/config";
import { AnalysisResponse } from "../types/api";

interface Props {
  data: AnalysisResponse;
}

function formatReport(data: AnalysisResponse): string {
  const status = data.determination ? "Damage Detected" : "No Damage Detected";
  const confidence = `${Math.round(data.confidence * 100)}%`;
  const evidenceLines = data.evidence.map((e) => `  • ${e}`).join("\n");

  return [
    "Photo Damage Analysis Report",
    "═".repeat(32),
    "",
    `Object:     ${data.subject}`,
    `Status:     ${status}`,
    `Confidence: ${confidence}`,
    `Location:   ${data.likely_location}`,
    "",
    "Evidence:",
    evidenceLines,
    "",
    "Recommended Action:",
    `  ${data.recommended_action}`,
  ].join("\n");
}

export default function CopyReportButton({ data }: Props) {
  const [copied, setCopied] = useState(false);

  async function handlePress() {
    await Clipboard.setStringAsync(formatReport(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Copy analysis report to clipboard"
      >
        <Text style={styles.icon}>⎘</Text>
        <Text style={styles.label}>Copy Report</Text>
      </Pressable>

      {copied && (
        <Text style={styles.confirmation} accessibilityLiveRegion="polite">
          Copied!
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 6 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: COLORS.surface,
  },
  btnPressed: { backgroundColor: COLORS.background },
  icon: { fontSize: 15, color: COLORS.textSecondary },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  confirmation: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: "600",
  },
});
