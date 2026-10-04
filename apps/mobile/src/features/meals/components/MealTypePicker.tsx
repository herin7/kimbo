import { MealTypeSchema, type MealType } from "@kimbo/contracts";
import { Pressable, StyleSheet, View } from "react-native";

import { Text, useKimboTheme } from "@/design-system";

const labels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function MealTypePicker({ value, onChange }: { value: MealType; onChange: (value: MealType) => void }) {
  const { colors, radius, spacing } = useKimboTheme();
  return (
    <View accessibilityRole="radiogroup" style={[styles.row, { gap: spacing.sm }]}>
      {MealTypeSchema.options.map((mealType) => {
        const selected = value === mealType;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={mealType}
            onPress={() => onChange(mealType)}
            style={({ pressed }) => [styles.option, {
              backgroundColor: selected ? colors.brandSoft : colors.surface,
              borderColor: selected ? colors.brand : colors.border,
              borderRadius: radius.pill,
              opacity: pressed ? 0.72 : 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }]}
          >
            <Text color={selected ? "brand" : "secondary"} variant="caption">{labels[mealType]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap" }, option: { borderWidth: 1 } });
