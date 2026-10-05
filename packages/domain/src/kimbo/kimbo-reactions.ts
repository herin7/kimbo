import type { DailyHealthSummary, Nutrition } from "@kimbo/contracts";

import { evaluateDay, localClock, type CoachingDay } from "../coaching/coaching.js";

/** Moods map 1:1 onto the Rive state machine triggers (neutral = idle, no trigger). */
export type KimboMood = "happy" | "playful" | "neutral" | "sad" | "angry";
export type MealQuality = "great" | "balanced" | "heavy" | "poor";
export type KimboTopic = "meal" | "walk" | "goals" | "calories" | "protein" | "movement" | "breakfast" | "idle";

export interface KimboReaction {
  mood: KimboMood;
  line: string;
  topic: KimboTopic;
}

export interface KimboDayInput {
  now: Date;
  meals: ReadonlyArray<{ occurredAt: string; totals: Nutrition }>;
  calorieTarget: number;
  proteinTargetGrams: number;
  steps: number;
  stepTarget: number;
  isWalking: boolean;
  walkingStartedAt?: string | null;
  timeZone: string;
}

const RECENT_MEAL_MS = 20 * 60_000;
const fmt = (value: number) => Math.round(value).toLocaleString("en-IN");
const rotate = (now: Date, lines: readonly string[]) => lines[Math.floor(now.getTime() / (15 * 60_000)) % lines.length] ?? lines[0] ?? "";

export function assessMealQuality(totals: Nutrition): MealQuality {
  if (totals.calories <= 0) return "balanced";
  const proteinShare = (totals.proteinGrams * 4) / totals.calories;
  const fatShare = (totals.fatGrams * 9) / totals.calories;
  if (proteinShare < 0.1 && (fatShare >= 0.45 || totals.calories >= 700)) return "poor";
  if (totals.calories >= 1_000 || (totals.calories >= 750 && fatShare >= 0.38)) return "heavy";
  if (fatShare >= 0.45 || (totals.calories >= 900 && proteinShare < 0.2)) return "heavy";
  if (proteinShare >= 0.25 && fatShare <= 0.35 && totals.calories <= 650) return "great";
  return "balanced";
}

export function reactToMeal(totals: Nutrition, proteinLeftGrams: number): KimboReaction {
  const protein = fmt(totals.proteinGrams);
  switch (assessMealQuality(totals)) {
    case "great":
      return { mood: "happy", topic: "meal", line: `Now that's a plate! ${protein} g of protein in one go.` };
    case "heavy":
      return { mood: "sad", topic: "meal", line: "That was a lot for one meal. No guilt. Make the next choice lighter and more balanced." };
    case "poor":
      return {
        mood: "angry",
        topic: "meal",
        line: proteinLeftGrams > 0 ? `That meal was light on protein. ${fmt(proteinLeftGrams)} g remains, so make the next plate protein-forward.` : "Protein is covered. Make the next plate more balanced.",
      };
    default:
      return { mood: "happy", topic: "meal", line: proteinLeftGrams > 0 ? `Solid meal. ${fmt(proteinLeftGrams)} g of protein to go.` : "Solid meal. Protein is covered for today!" };
  }
}

const totalsFor = (input: KimboDayInput) => {
  const calories = input.meals.reduce((sum, meal) => sum + meal.totals.calories, 0);
  const protein = input.meals.reduce((sum, meal) => sum + meal.totals.proteinGrams, 0);
  return {
    calories,
    protein,
    proteinLeft: Math.max(0, input.proteinTargetGrams - protein),
    proteinProgress: input.proteinTargetGrams > 0 ? protein / input.proteinTargetGrams : 0,
    stepsLeft: Math.max(0, input.stepTarget - input.steps),
    stepProgress: input.stepTarget > 0 ? input.steps / input.stepTarget : 0,
  };
};

export function coachingDayFrom(input: KimboDayInput, history: DailyHealthSummary[] = [], sentToday: string[] = []): CoachingDay {
  const clock = localClock(input.now, input.timeZone);
  return {
    ...clock,
    calorieTarget: input.calorieTarget,
    proteinTargetGrams: input.proteinTargetGrams,
    stepTarget: input.stepTarget,
    meals: input.meals.map((meal) => ({
      minute: localClock(new Date(meal.occurredAt), input.timeZone).minute,
      calories: meal.totals.calories,
      proteinGrams: meal.totals.proteinGrams,
    })),
    steps: input.steps,
    history: history.filter((day) => day.date < clock.date).slice(-14),
    sentToday,
  };
}

/** Fresh actions keep precedence; otherwise the shared coaching engine owns the message. */
export function deriveKimboReaction(input: KimboDayInput, history: DailyHealthSummary[] = [], sentToday: string[] = []): KimboReaction {
  const totals = totalsFor(input);
  const latestMeal = [...input.meals].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const latestMealAt = latestMeal ? new Date(latestMeal.occurredAt).getTime() : Number.NEGATIVE_INFINITY;
  const walkingStartedAt = input.walkingStartedAt ? new Date(input.walkingStartedAt).getTime() : Number.POSITIVE_INFINITY;
  const walkIsLatestAction = input.isWalking && walkingStartedAt >= latestMealAt;

  if (walkIsLatestAction || (input.isWalking && (!latestMeal || input.now.getTime() - latestMealAt > RECENT_MEAL_MS))) {
    return totals.stepsLeft === 0
      ? { mood: "happy", topic: "walk", line: rotate(input.now, ["Goal complete. Every comfortable step now is a bonus.", "You did it. Keep walking only if it still feels good."]) }
      : { mood: "playful", topic: "walk", line: rotate(input.now, [`Keep going. ${fmt(totals.stepsLeft)} steps remain.`, `${fmt(totals.stepsLeft)} left. Find a good song and keep the pace.`, "Shoulders loose, eyes up. You're moving now!"]) };
  }

  if (latestMeal && input.now.getTime() - latestMealAt <= RECENT_MEAL_MS) return reactToMeal(latestMeal.totals, totals.proteinLeft);

  const insight = evaluateDay(coachingDayFrom(input, history, sentToday))[0];
  if (insight) return { mood: insight.mood, topic: insight.topic, line: `${insight.explanation} ${insight.action.label}.` };

  const { minute } = localClock(input.now, input.timeZone);
  if (minute >= 660 && input.meals.length === 0) {
    return { mood: "sad", topic: "breakfast", line: rotate(input.now, ["Running on empty here. Log your first meal?", "No meal logged yet. Feed yourself, then tell me what it was."]) };
  }
  if (totals.stepProgress >= 0.75 && totals.stepsLeft > 0) {
    return { mood: "playful", topic: "movement", line: `${fmt(totals.stepsLeft)} steps remain. A short victory lap can close it.` };
  }
  if (input.meals.length === 0) {
    return { mood: "neutral", topic: "breakfast", line: rotate(input.now, ["Morning! What's on the plate today?", "New day. One good meal and one good walk."]) };
  }
  return { mood: "neutral", topic: "idle", line: "Pick the smallest useful action and do that next." };
}
