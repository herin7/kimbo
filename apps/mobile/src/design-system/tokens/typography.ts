import type { TextStyle } from "react-native";

export const typography = {
  display: { fontFamily: "Manrope_700Bold", fontSize: 44, lineHeight: 50, letterSpacing: -1.6 },
  title: { fontFamily: "Manrope_700Bold", fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  heading: { fontFamily: "Manrope_600SemiBold", fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
  body: { fontFamily: "Manrope_400Regular", fontSize: 16, lineHeight: 24, letterSpacing: -0.12 },
  bodySmall: { fontFamily: "Manrope_400Regular", fontSize: 14, lineHeight: 20, letterSpacing: -0.08 },
  caption: { fontFamily: "Manrope_600SemiBold", fontSize: 12, lineHeight: 16, letterSpacing: 0.12 },
  numericLarge: {
    fontFamily: "Manrope_700Bold",
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.4,
    fontVariant: ["tabular-nums"],
  },
  numericMedium: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
