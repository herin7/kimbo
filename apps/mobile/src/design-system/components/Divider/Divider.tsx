import { View, type ViewStyle } from "react-native";

import { useKimboTheme } from "../../theme";

export function Divider({ style }: { style?: ViewStyle }) {
  const { colors } = useKimboTheme();
  return <View style={[{ backgroundColor: colors.border, height: 1 }, style]} />;
}
