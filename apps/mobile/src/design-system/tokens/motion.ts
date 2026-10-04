import { Easing } from "react-native-reanimated";

export const motion = {
  duration: {
    fast: 120,
    normal: 220,
    slow: 320,
  },
  easing: {
    standard: Easing.bezier(0.23, 1, 0.32, 1),
    move: Easing.bezier(0.77, 0, 0.175, 1),
    sheet: Easing.bezier(0.32, 0.72, 0, 1),
  },
  spring: {
    snappy: { duration: 260, dampingRatio: 0.9 },
    soft: { duration: 400, dampingRatio: 1 },
  },
} as const;
