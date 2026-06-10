import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, FONT_SIZE, RADIUS } from "../constants/config";
import { AnalysisResponse } from "../types/api";

interface Props {
  data: AnalysisResponse;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? COLORS.success : pct >= 65 ? COLORS.warning : COLORS.danger;

  return (
    <View style={styles.barSection}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>Confidence</Text>
        <Text style={[styles.barPct, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function DeterminationBadge({ value }: { value: boolean }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: value ? COLORS.dangerLight : COLORS.successLight },
      ]}
    >
      <Text
        style={[styles.badgeText, { color: value ? COLORS.danger : COLORS.success }]}
      >
        {value ? "Damage Detected" : "No Damage Found"}
      </Text>
    </View>
  );
}

function EvidenceChip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

export default function ResultCard({ data }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.subject}>{data.subject}</Text>

      <DeterminationBadge value={data.determination} />

      <ConfidenceBar value={data.confidence} />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Location</Text>
        <Text style={styles.sectionValue}>{data.likely_location}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Evidence</Text>
        <View style={styles.chipsRow}>
          {data.evidence.map((item, i) => (
            <EvidenceChip key={i} text={item} />
          ))}
        </View>
      </View>

      <View style={[styles.section, styles.actionBox]}>
        <Text style={styles.sectionLabel}>Recommended Action</Text>
        <Text style={styles.actionText}>{data.recommended_action}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  subject: {
    fontSize: FONT_SIZE["2xl"],
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 30,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  badgeText: { fontSize: FONT_SIZE.sm, fontWeight: "600" },
  barSection: { gap: 6 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  barPct: { fontSize: FONT_SIZE.sm, fontWeight: "700" },
  barTrack: {
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: RADIUS.full },
  section: { gap: 6 },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "600",
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionValue: { fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  chipText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: "500" },
  actionBox: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: 12,
  },
  actionText: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
});
