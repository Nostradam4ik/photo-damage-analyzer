import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT_SIZE, RADIUS } from "../constants/config";
import { AnalyzeError } from "../types/api";

interface Props {
  error: AnalyzeError;
  onRetry?: () => void;
}

export default function ErrorBanner({ error, onRetry }: Props) {
  const isRetryable = error.kind === "network" || error.kind === "timeout";

  return (
    <View style={styles.container}>
      <View style={styles.iconRow}>
        <Text style={styles.icon}>{isRetryable ? "⚡" : "⚠"}</Text>
        <Text style={styles.title}>{error.message}</Text>
      </View>
      <Text style={styles.detail}>{error.detail}</Text>

      {isRetryable && onRetry && (
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}

      {!isRetryable && (
        <Text style={styles.fallback}>
          If this continues, please complete a manual review and contact support.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.lg,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  iconRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { fontSize: 18 },
  title: {
    fontSize: FONT_SIZE.base,
    fontWeight: "600",
    color: COLORS.danger,
    flex: 1,
  },
  detail: { fontSize: FONT_SIZE.sm, color: COLORS.dangerDark, lineHeight: 20 },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.danger,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  retryBtnPressed: { opacity: 0.8 },
  retryText: { color: "#fff", fontSize: FONT_SIZE.sm, fontWeight: "600" },
  fallback: { fontSize: FONT_SIZE.sm, color: COLORS.dangerDark, fontStyle: "italic" },
});
