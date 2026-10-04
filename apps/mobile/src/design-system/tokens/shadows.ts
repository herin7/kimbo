import type { ViewStyle } from "react-native";

export const shadows = {
  card: { boxShadow: "0 10px 28px rgba(0, 0, 0, 0.14)" },
  overlay: { boxShadow: "0 18px 48px rgba(0, 0, 0, 0.32)" },
} as const satisfies Record<string, ViewStyle>;
