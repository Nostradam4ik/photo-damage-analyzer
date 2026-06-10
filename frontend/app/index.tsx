import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ImagePickerAsset } from "expo-image-picker";

import ErrorBanner from "../components/ErrorBanner";
import LoadingSkeleton from "../components/LoadingSkeleton";
import PhotoPicker from "../components/PhotoPicker";
import ResultCard from "../components/ResultCard";
import { COLORS, FONT_SIZE, RADIUS } from "../constants/config";
import { useAnalyze } from "../hooks/useAnalyze";

// ---------------------------------------------------------------------------
// Sub-screens
// ---------------------------------------------------------------------------

function NeedsMorePhotosScreen({
  confidence,
  onReset,
}: {
  confidence: number;
  onReset: () => void;
}) {
  return (
    <View style={styles.needsPhotosCard}>
      <Text style={styles.needsPhotosIcon}>📷</Text>
      <Text style={styles.needsPhotosTitle}>Better photos needed</Text>
      <Text style={styles.needsPhotosBody}>
        The current images produced a confidence score of{" "}
        <Text style={{ fontWeight: "700" }}>{Math.round(confidence * 100)}%</Text>, which
        is below the threshold for a reliable assessment. Please retake photos with better
        lighting, closer framing, or from a different angle.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
        onPress={onReset}
        accessibilityRole="button"
      >
        <Text style={styles.primaryBtnText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const [photos, setPhotos] = React.useState<ImagePickerAsset[]>([]);
  const { state, analyze, reset } = useAnalyze();

  function handleAnalyze() {
    analyze(photos);
  }

  function handleReset() {
    setPhotos([]);
    reset();
  }

  const canAnalyze = photos.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Photo Damage Analyzer</Text>
          <Text style={styles.headerSubtitle}>
            Upload 1–3 photos for an AI-powered damage assessment
          </Text>
        </View>

        {/* Photo picker — hide while showing results */}
        {state.phase !== "result" && state.phase !== "needs_photos" && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Photos</Text>
            <PhotoPicker photos={photos} onChange={setPhotos} />

            {/* No-photo warning */}
            {state.phase === "idle" && photos.length === 0 && (
              <Text style={styles.inlineWarning}>
                Select at least one photo to continue.
              </Text>
            )}
          </View>
        )}

        {/* Analyse / loading / result area */}
        <View style={styles.section}>
          {state.phase === "idle" && (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                !canAnalyze && styles.primaryBtnDisabled,
                pressed && canAnalyze && styles.primaryBtnPressed,
              ]}
              onPress={handleAnalyze}
              disabled={!canAnalyze}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAnalyze }}
            >
              <Text style={styles.primaryBtnText}>Analyse Photos</Text>
            </Pressable>
          )}

          {state.phase === "loading" && <LoadingSkeleton />}

          {state.phase === "result" && (
            <>
              <ResultCard data={state.data} />
              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
                onPress={handleReset}
                accessibilityRole="button"
              >
                <Text style={styles.ghostBtnText}>Analyse More Photos</Text>
              </Pressable>
            </>
          )}

          {state.phase === "needs_photos" && (
            <NeedsMorePhotosScreen
              confidence={state.data.confidence}
              onReset={handleReset}
            />
          )}

          {state.phase === "error" && (
            <>
              <ErrorBanner
                error={state.error}
                onRetry={state.error.kind === "network" ? handleAnalyze : undefined}
              />
              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
                onPress={handleReset}
                accessibilityRole="button"
              >
                <Text style={styles.ghostBtnText}>Start Over</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 24, paddingBottom: 48 },

  header: { gap: 6, paddingTop: 8 },
  headerTitle: {
    fontSize: FONT_SIZE["2xl"],
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  section: { gap: 12 },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  inlineWarning: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.warning,
    marginTop: -4,
  },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: { backgroundColor: COLORS.textTertiary },
  primaryBtnPressed: { backgroundColor: COLORS.primaryDark },
  primaryBtnText: { color: "#fff", fontSize: FONT_SIZE.base, fontWeight: "700" },

  ghostBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostBtnPressed: { backgroundColor: COLORS.background },
  ghostBtnText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.base, fontWeight: "600" },

  needsPhotosCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  needsPhotosIcon: { fontSize: 48 },
  needsPhotosTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  needsPhotosBody: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
