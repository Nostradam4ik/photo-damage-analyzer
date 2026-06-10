import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { COLORS, RADIUS } from "../constants/config";

function SkeletonBlock({ width, height }: { width: number | string; height: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width: width as number, height, opacity: anim, borderRadius: RADIUS.sm },
      ]}
    />
  );
}

export default function LoadingSkeleton() {
  return (
    <View style={styles.card}>
      {/* Subject */}
      <SkeletonBlock width="60%" height={22} />

      {/* Badge row */}
      <View style={styles.row}>
        <SkeletonBlock width={120} height={28} />
        <SkeletonBlock width={80} height={28} />
      </View>

      {/* Confidence bar */}
      <View style={styles.barContainer}>
        <SkeletonBlock width="100%" height={10} />
      </View>

      {/* Location */}
      <SkeletonBlock width="80%" height={16} />

      {/* Evidence chips */}
      <View style={styles.row}>
        <SkeletonBlock width={90} height={24} />
        <SkeletonBlock width={110} height={24} />
        <SkeletonBlock width={75} height={24} />
      </View>

      {/* Action */}
      <SkeletonBlock width="90%" height={16} />
      <SkeletonBlock width="50%" height={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  block: { backgroundColor: COLORS.border },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  barContainer: { width: "100%", borderRadius: RADIUS.sm, overflow: "hidden" },
});
