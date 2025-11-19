// Theme constants for consistent styling across the mobile app
export const COLORS = {
  primary: "#dfa974",
  secondary: "#19191a",
  white: "#ffffff",
  black: "#000000",
  gray: "#707079",
  lightGray: "#e8e8e8",
  darkGray: "#2e2e2e",
  background: "#f9f9f9",
  success: "#28a745",
  error: "#dc3545",
  warning: "#dfa974",
  overlay: "rgba(0, 0, 0, 0.4)",
  overlayDark: "rgba(25, 25, 26, 0.9)",
  border: "#e8e8e8",
};

export const SIZES = {
  // Font sizes
  h1: 36,
  h2: 32,
  h3: 24,
  h4: 20,
  body1: 16,
  body2: 15,
  body3: 14,
  body4: 13,
  body5: 12,

  // Spacing
  base: 8,
  padding: 16,
  margin: 16,
  radius: 4,
  radiusLarge: 8,

  // App dimensions
  width: 375,
  height: 812,
};

export const FONTS = {
  h1: { fontSize: SIZES.h1, fontWeight: "700" as const, lineHeight: 48 },
  h2: { fontSize: SIZES.h2, fontWeight: "700" as const, lineHeight: 42 },
  h3: { fontSize: SIZES.h3, fontWeight: "700" as const, lineHeight: 32 },
  h4: { fontSize: SIZES.h4, fontWeight: "600" as const, lineHeight: 28 },
  body1: { fontSize: SIZES.body1, fontWeight: "400" as const, lineHeight: 24 },
  body2: { fontSize: SIZES.body2, fontWeight: "400" as const, lineHeight: 24 },
  body3: { fontSize: SIZES.body3, fontWeight: "400" as const, lineHeight: 22 },
  body4: { fontSize: SIZES.body4, fontWeight: "400" as const, lineHeight: 20 },
  body5: { fontSize: SIZES.body5, fontWeight: "400" as const, lineHeight: 18 },
};

export const SHADOWS = {
  light: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  dark: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
};

export default { COLORS, SIZES, FONTS, SHADOWS };
