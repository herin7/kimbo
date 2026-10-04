import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useKimboTheme } from "../../theme";
import { Text } from "../Text";

export interface TextFieldProps extends TextInputProps {
  label: string;
  suffix?: string;
  error?: string;
}

export function TextField({ label, suffix, error, style, ...props }: TextFieldProps) {
  const { colors, radius, sizing, spacing, typography } = useKimboTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="bodySmall" style={styles.label}>{label}</Text>
      <View style={[styles.field, {
        backgroundColor: colors.surface,
        borderColor: error ? colors.danger : colors.border,
        borderRadius: radius.md,
        minHeight: sizing.touchTarget,
        paddingHorizontal: spacing.lg,
      }]}>
        <TextInput
          accessibilityLabel={suffix ? `${label} in ${suffix}` : label}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.brand}
          style={[styles.input, typography.body, { color: colors.textPrimary, paddingVertical: spacing.md }, style]}
          {...props}
        />
        {suffix ? <Text color="muted" variant="bodySmall">{suffix}</Text> : null}
      </View>
      {error ? <Text accessibilityRole="alert" color="danger" variant="caption">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "600" },
  field: { alignItems: "center", borderCurve: "continuous", borderWidth: 1, flexDirection: "row" },
  input: { flex: 1 },
});
