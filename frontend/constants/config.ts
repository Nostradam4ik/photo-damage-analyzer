export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const MAX_PHOTOS = 3;

export const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#DBEAFE",
  success: "#16A34A",
  successLight: "#DCFCE7",
  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  dangerBorder: "#FECACA",
  dangerDark: "#B91C1C",
  warning: "#D97706",
  warningLight: "#FEF3C7",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;
