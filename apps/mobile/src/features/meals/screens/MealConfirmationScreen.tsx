import type { MealDraft, MealItem } from "@kimbo/contracts";
import { reactToMeal, sumNutrition } from "@kimbo/domain";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Badge, Button, Card, Divider, Screen, Text, useKimboTheme } from "@/design-system";
import { KimboSays } from "@/features/kimbo/components/KimboSays";
import { useKimboDay } from "@/features/kimbo/hooks/useKimboDay";

import { MealItemEditor } from "../components/MealItemEditor";
import { MealTypePicker } from "../components/MealTypePicker";
import { useMealDraft, useSaveMeal, useSaveMealDraft } from "../hooks/meal.queries";

export function MealConfirmationScreen() {
  const router = useRouter();
  const { spacing } = useKimboTheme();
  const { data: draft, isLoading } = useMealDraft();
  const saveDraft = useSaveMealDraft();
  const saveMeal = useSaveMeal();
  const day = useKimboDay();

  if (isLoading) {
    return <Screen><Text color="secondary">Preparing your meal…</Text></Screen>;
  }

  if (!draft) {
    return (
      <Screen>
        <Text variant="title">There’s no meal to review</Text>
        <Text color="secondary">Start a new meal and Kimbo will keep it here until you confirm.</Text>
        <Button onPress={() => router.replace("/meal/capture")}>Log food</Button>
      </Screen>
    );
  }

  const totals = sumNutrition(draft.items);
  const isLowConfidence = draft.items.some((item) => item.confidence < 0.7);
  // Kimbo judges the plate live, so adjusting portions changes his mood before saving.
  const proteinLeft = day ? day.goal.dailyProteinTargetGrams - day.protein - totals.proteinGrams : 0;
  const kimbo = reactToMeal(totals, Math.max(0, proteinLeft));
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(draft.occurredAt));

  const updateDraft = (next: MealDraft) => saveDraft.mutate(next);
  const updateItem = (index: number, item: MealItem) => {
    const items = draft.items.map((current, currentIndex) => currentIndex === index ? item : current);
    updateDraft({ ...draft, items });
  };
  const removeItem = (index: number) => {
    const items = draft.items.filter((_, currentIndex) => currentIndex !== index);
    if (items.length === 0) return;
    updateDraft({ ...draft, items });
  };
  const handleConfirm = async () => {
    if (saveMeal.isPending) return;
    await saveMeal.mutateAsync({
      ...draft,
      totals,
      syncStatus: "pending",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissTo("/today");
  };

  return (
    <Screen>
      <View style={styles.titleRow}>
        <View style={[styles.titleContent, { gap: spacing.xs }]}>
          <Text variant="title">Review your meal</Text>
          <Text color="secondary">{time} · {draft.items.length} {draft.items.length === 1 ? "item" : "items"}</Text>
        </View>
        <Badge label={draft.source === "manual" ? "Manual" : "Estimate"} />
      </View>

      {isLowConfidence ? (
        <Card variant="outlined">
          <Text variant="heading">Check the portion sizes</Text>
          <Text color="secondary">Kimbo isn’t completely sure about this estimate. Adjust anything that looks off.</Text>
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="bodySmall">Meal</Text>
        <MealTypePicker value={draft.mealType} onChange={(mealType) => updateDraft({ ...draft, mealType })} />
      </View>

      <View style={{ gap: spacing.md }}>
        {draft.items.map((item, index) => (
          <MealItemEditor
            item={item}
            key={item.id ?? `${item.name}-${index}`}
            onChange={(next) => updateItem(index, next)}
            onRemove={() => removeItem(index)}
          />
        ))}
      </View>

      <Button onPress={() => router.push({ pathname: "/meal/manual", params: { append: "1" } })} variant="ghost">
        Add another food
      </Button>

      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={styles.totalRow}>
            <Text variant="heading">Estimated total</Text>
            <Text variant="numericMedium">{Math.round(totals.calories)} kcal</Text>
          </View>
          <Divider />
          <View style={styles.macros}>
            <Macro label="Protein" value={`${Math.round(totals.proteinGrams)}g`} />
            <Macro label="Carbs" value={`${Math.round(totals.carbsGrams)}g`} />
            <Macro label="Fat" value={`${Math.round(totals.fatGrams)}g`} />
          </View>
        </View>
      </Card>

      <Card variant="outlined">
        <KimboSays line={kimbo.line} mood={kimbo.mood} size={64} />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button loading={saveMeal.isPending} onPress={handleConfirm}>Looks right</Button>
        <Text color="muted" style={styles.syncNote} variant="caption">
          Saved safely on this device first. Kimbo will sync it when the server is available.
        </Text>
      </View>
    </Screen>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macro}>
      <Text variant="heading">{value}</Text>
      <Text color="secondary" variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { alignItems: "flex-start", flexDirection: "row" },
  titleContent: { flex: 1 },
  totalRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  macros: { flexDirection: "row" },
  macro: { flex: 1 },
  syncNote: { textAlign: "center" },
});
