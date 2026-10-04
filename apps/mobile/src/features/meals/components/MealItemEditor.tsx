import type { MealItem } from "@kimbo/contracts";
import { updateMealItemQuantity } from "@kimbo/domain";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Card, Text, TextField, useKimboTheme } from "@/design-system";

interface MealItemEditorProps {
  item: MealItem;
  onChange: (item: MealItem) => void;
  onRemove: () => void;
}

export function MealItemEditor({ item, onChange, onRemove }: MealItemEditorProps) {
  const { spacing } = useKimboTheme();
  const [amount, setAmount] = useState(String(item.portion.amount));

  const commitAmount = () => {
    const parsed = Number(amount);
    if (Number.isFinite(parsed) && parsed > 0) {
      onChange(updateMealItemQuantity(item, parsed));
      return;
    }
    setAmount(String(item.portion.amount));
  };

  return (
    <Card variant="outlined">
      <View style={{ gap: spacing.md }}>
        <View style={styles.headingRow}>
          <View style={styles.name}>
            <Text variant="heading">{item.name}</Text>
            <Text color="secondary" variant="bodySmall">
              {Math.round(item.nutrition.calories)} kcal
            </Text>
          </View>
          <Button accessibilityHint={`Removes ${item.name} from this meal`} onPress={onRemove} size="sm" variant="ghost">
            Remove
          </Button>
        </View>
        <TextField
          keyboardType="decimal-pad"
          label="Quantity"
          onBlur={commitAmount}
          onChangeText={setAmount}
          returnKeyType="done"
          suffix={item.portion.unit}
          value={amount}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headingRow: { alignItems: "flex-start", flexDirection: "row" },
  name: { flex: 1 },
});
