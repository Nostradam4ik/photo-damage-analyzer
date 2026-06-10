import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { COLORS } from "../constants/config";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: "none",
        }}
      />
    </>
  );
}
