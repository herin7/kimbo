import { MealItemSchema, type MealDraft, type MealType } from "@kimbo/contracts";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Button, Screen, Text, TextField, useKimboTheme } from "@/design-system";

import { MealTypePicker } from "../components/MealTypePicker";
import { getDefaultMealType } from "../domain/meal.defaults";
import { useMealDraft, useSaveMealDraft } from "../hooks/meal.queries";

const asNumber = (value: string) => Number(value.trim());

export function ManualMealScreen() {
  const router = useRouter();
  const { append } = useLocalSearchParams<{ append?: string }>();
  const { spacing } = useKimboTheme();
  const { data: existingDraft } = useMealDraft();
  const saveDraft = useSaveMealDraft();
  const shouldAppend = append === "1" && Boolean(existingDraft);
  const initialMealType = useMemo(
    () => (shouldAppend && existingDraft ? existingDraft.mealType : getDefaultMealType()),
    [existingDraft, shouldAppend],
  );

  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState("serving");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("0");
  const [carbs, setCarbs] = useState("0");
  const [fat, setFat] = useState("0");
  const [error, setError] = useState<string>();

  const handleContinue = async () => {
    const item = MealItemSchema.safeParse({
      id: Crypto.randomUUID(),
      name,
      portion: {
        amount: asNumber(amount),
        unit,
        displayText: `${amount.trim()} ${unit.trim()}`,
      },
      nutrition: {
        calories: asNumber(calories),
        proteinGrams: asNumber(protein),
        carbsGrams: asNumber(carbs),
        fatGrams: asNumber(fat),
      },
      confidence: 1,
    });

    if (!item.success) {
      setError("Add a food name, a positive quantity, and valid nutrition values.");
      return;
    }

    const draft: MealDraft = shouldAppend && existingDraft
      ? { ...existingDraft, mealType, items: [...existingDraft.items, item.data] }
      : {
          id: Crypto.randomUUID(),
          mealType,
          source: "manual",
          items: [item.data],
          occurredAt: new Date().toISOString(),
        };

    setError(undefined);
    await saveDraft.mutateAsync(draft);
    router.replace("/meal/confirm");
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">{shouldAppend ? "Add another food" : "Enter your meal"}</Text>
        <Text color="secondary">Use the best estimate you have. You can edit it before saving.</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="bodySmall">Meal</Text>
        <MealTypePicker onChange={setMealType} value={mealType} />
      </View>

      <View style={{ gap: spacing.lg }}>
        <TextField autoCapitalize="words" label="Food" onChangeText={setName} placeholder="e.g. Paneer sabzi" value={name} />
        <View style={{ gap: spacing.md }}>
          <TextField keyboardType="decimal-pad" label="Quantity" onChangeText={setAmount} value={amount} />
          <TextField autoCapitalize="none" label="Unit" onChangeText={setUnit} placeholder="serving, bowl, roti…" value={unit} />
        </View>
        <TextField keyboardType="decimal-pad" label="Calories" onChangeText={setCalories} suffix="kcal" value={calories} />
        <TextField keyboardType="decimal-pad" label="Protein" onChangeText={setProtein} suffix="g" value={protein} />
        <TextField keyboardType="decimal-pad" label="Carbs" onChangeText={setCarbs} suffix="g" value={carbs} />
        <TextField keyboardType="decimal-pad" label="Fat" onChangeText={setFat} suffix="g" value={fat} />
      </View>

      {error ? <Text accessibilityRole="alert" color="danger">{error}</Text> : null}
      <Button loading={saveDraft.isPending} onPress={handleContinue}>
        Review meal
      </Button>
    </Screen>
  );
}
