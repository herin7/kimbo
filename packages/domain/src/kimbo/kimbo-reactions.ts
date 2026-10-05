import type { Nutrition } from "@kimbo/contracts";

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
  /** Today's confirmed meals only. */
  meals: ReadonlyArray<{ occurredAt: string; totals: Nutrition }>;
  calorieTarget: number;
  proteinTargetGrams: number;
  steps: number;
  stepTarget: number;
  isWalking: boolean;
  /** Start time lets a newly started walk take precedence over an older recent meal. */
  walkingStartedAt?: string | null;
}

export interface KimboNudge {
  id: string;
  at: Date;
  title: string;
  body: string;
}

const RECENT_MEAL_MS = 20 * 60_000;
const fmt = (value: number) => Math.round(value).toLocaleString("en-IN");
/** Rotate coaching copy slowly so Kimbo stays present without flickering on every render. */
const rotate = (now: Date, lines: readonly string[]) => lines[Math.floor(now.getTime() / (15 * 60_000)) % lines.length] ?? lines[0] ?? "";

/**
 * Judges a meal by where its energy comes from. Deliberately coarse: Kimbo reacts to obvious
 * patterns (protein-forward vs. fat-heavy, low-protein plates), never to precise nutrition claims.
 */
export function assessMealQuality(totals: Nutrition): MealQuality {
  if (totals.calories <= 0) return "balanced";
  const proteinShare = (totals.proteinGrams * 4) / totals.calories;
  const fatShare = (totals.fatGrams * 9) / totals.calories;
  // Protein is a useful signal, not a health halo. A very large or fat-heavy meal should not
  // become "great" just because it contains chicken, cheese, or a protein supplement.
  if (proteinShare < 0.1 && (fatShare >= 0.45 || totals.calories >= 700)) return "poor";
  if (totals.calories >= 1_000 || (totals.calories >= 750 && fatShare >= 0.38)) return "heavy";
  if (fatShare >= 0.45 || (totals.calories >= 900 && proteinShare < 0.2)) return "heavy";
  if (proteinShare >= 0.25 && fatShare <= 0.35 && totals.calories <= 650) return "great";
  return "balanced";
}

/** Kimbo's reaction to one meal, used right after it is reviewed or saved. */
export function reactToMeal(totals: Nutrition, proteinLeftGrams: number): KimboReaction {
  const protein = fmt(totals.proteinGrams);
  switch (assessMealQuality(totals)) {
    case "great":
      return { mood: "happy", topic: "meal", line: `Now that's a plate! ${protein} g of protein in one go.` };
    case "heavy":
      return { mood: "sad", topic: "meal", line: "That was a lot for one meal. No guilt—make the next choice lighter and more balanced." };
    case "poor":
      return {
        mood: "angry",
        topic: "meal",
        line: proteinLeftGrams > 0
          ? `Where's the protein in that?! ${fmt(proteinLeftGrams)} g still missing today.`
          : "Tasty, sure. Nutritious? We both know the answer.",
      };
    default:
      return {
        mood: "happy",
        topic: "meal",
        line: proteinLeftGrams > 0 ? `Solid meal. ${fmt(proteinLeftGrams)} g of protein to go.` : "Solid meal. Protein's covered for today!",
      };
  }
}

interface DayTotals {
  calories: number;
  protein: number;
  proteinLeft: number;
  proteinProgress: number;
  stepsLeft: number;
  stepProgress: number;
}

const totalsFor = (input: KimboDayInput): DayTotals => {
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

/**
 * Kimbo's current mood and what he says about the day, in priority order: a fresh meal first,
 * then a live walk, wins, and finally the most pressing gap for the time of day.
 */
export function deriveKimboReaction(input: KimboDayInput): KimboReaction {
  const day = totalsFor(input);
  const hour = input.now.getHours();
  const latestMeal = [...input.meals].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const latestMealAt = latestMeal ? new Date(latestMeal.occurredAt).getTime() : Number.NEGATIVE_INFINITY;
  const walkingStartedAt = input.walkingStartedAt ? new Date(input.walkingStartedAt).getTime() : Number.POSITIVE_INFINITY;
  const walkIsLatestAction = input.isWalking && walkingStartedAt >= latestMealAt;

  if (walkIsLatestAction) {
    return day.stepsLeft === 0
      ? { mood: "happy", topic: "walk", line: rotate(input.now, ["Goal smashed! Every step now is pure bonus.", "You did it. Keep walking only if it still feels good."]) }
      : { mood: "playful", topic: "walk", line: rotate(input.now, [`Keep going! ${fmt(day.stepsLeft)} steps and I do my happy dance.`, `${fmt(day.stepsLeft)} left. Find a good song and keep the pace.`, "Shoulders loose, eyes up. We're moving now!"]) };
  }

  if (latestMeal && input.now.getTime() - latestMealAt <= RECENT_MEAL_MS) {
    return reactToMeal(latestMeal.totals, day.proteinLeft);
  }

  if (input.isWalking) {
    return day.stepsLeft === 0
      ? { mood: "happy", topic: "walk", line: rotate(input.now, ["Goal smashed! Every step now is pure bonus.", "You did it. Keep walking only if it still feels good."]) }
      : { mood: "playful", topic: "walk", line: rotate(input.now, [`Keep going! ${fmt(day.stepsLeft)} steps and I do my happy dance.`, `${fmt(day.stepsLeft)} left. Find a good song and keep the pace.`, "Shoulders loose, eyes up. We're moving now!"]) };
  }

  if (day.stepsLeft === 0 && day.proteinProgress >= 0.9) {
    return { mood: "happy", topic: "goals", line: rotate(input.now, ["Protein done, steps done. I'm so proud of you!", "Both goals handled. That's the kind of day we repeat."]) };
  }

  if (input.calorieTarget > 0 && day.calories > input.calorieTarget * 1.1) {
    return { mood: "sad", topic: "calories", line: rotate(input.now, ["We went over today. Tomorrow's a fresh page.", "A heavier day isn't a verdict. A short walk would still help."]) };
  }

  if (hour >= 18) {
    if (input.meals.length > 0 && day.proteinProgress < 0.6) {
      return { mood: "angry", topic: "protein", line: rotate(input.now, [`Who's covering today's protein? ${fmt(day.proteinLeft)} g still missing!`, `${fmt(day.proteinLeft)} g left this late? Dinner needs a protein plan.`]) };
    }
    if (day.stepProgress < 0.5) {
      return { mood: "angry", topic: "movement", line: rotate(input.now, [`${fmt(input.steps)} steps today?! Even I moved more, and I'm a ball.`, "Shoes on. Ten brisk minutes before the sofa wins."]) };
    }
  }

  if (hour >= 11 && input.meals.length === 0) {
    return { mood: "sad", topic: "breakfast", line: rotate(input.now, ["Running on empty here. Log your first meal?", "No meal logged yet. Feed yourself, then tell me what it was."]) };
  }

  if (hour >= 14) {
    if (day.stepProgress < 0.3) {
      return { mood: "sad", topic: "movement", line: rotate(input.now, ["Haven't seen you move since morning. Ten minutes outside?", "Tiny mission: one lap around the block before the next scroll."]) };
    }
    if (day.proteinProgress < 0.35) {
      return { mood: "sad", topic: "protein", line: "Protein's lagging. Eggs, paneer, dal… pick one!" };
    }
  }

  if (day.stepProgress >= 0.75 && day.stepsLeft > 0) {
    return { mood: "playful", topic: "movement", line: rotate(input.now, [`So close! ${fmt(day.stepsLeft)} steps feels like a victory lap.`, `${fmt(day.stepsLeft)} steps left. Don't leave that streak on the table.`]) };
  }

  if (day.stepProgress >= 0.5 || day.proteinProgress >= 0.6) {
    const topic = day.stepProgress < day.proteinProgress ? "movement" : "protein";
    return {
      mood: "playful",
      topic,
      line: rotate(input.now, [
        `Good momentum. Now close the ${topic === "movement" ? `${fmt(day.stepsLeft)}-step` : `${fmt(day.proteinLeft)} g`} gap.`,
        `Halfway is where days drift. One more ${topic === "movement" ? "walk" : "protein-first meal"} keeps this one alive.`,
      ]),
    };
  }

  if (input.meals.length === 0) {
    return { mood: "neutral", topic: "breakfast", line: rotate(input.now, ["Morning! What's on the plate today?", "New day. Give me one good meal and one good walk."]) };
  }

  return {
    mood: "neutral",
    topic: "idle",
    line: rotate(input.now, [`${fmt(day.proteinLeft)} g protein and ${fmt(day.stepsLeft)} steps left. We've got this.`, `Next move: ${day.proteinLeft > 0 ? `${fmt(day.proteinLeft)} g protein` : `${fmt(day.stepsLeft)} steps`}. Keep it simple.`, "You're not behind. Pick the smallest useful action and do it now."]),
  };
}

/** Kimbo's one-line take on the week, aimed at its weakest habit. */
export function reactToWeek(input: {
  daysWithData: number;
  caloriesPercent: number;
  movementPercent: number;
  proteinPercent: number;
  weakestMetric: "calories" | "movement" | "protein" | null;
}): KimboReaction {
  if (input.daysWithData === 0) {
    return { mood: "neutral", topic: "idle", line: "Nothing logged this week yet. One meal is all it takes to start." };
  }
  const average = (input.caloriesPercent + input.movementPercent + input.proteinPercent) / 3;
  if (average >= 75) {
    return { mood: "happy", topic: "goals", line: "Look at this week! Keep making me this proud." };
  }
  if (average < 50) {
    switch (input.weakestMetric) {
      case "protein":
        return { mood: "angry", topic: "protein", line: "Protein kept slipping all week. Who's covering it next week?" };
      case "movement":
        return { mood: "sad", topic: "movement", line: "We sat a lot this week. Short walks add up, I promise." };
      case "calories":
        return { mood: "sad", topic: "calories", line: "Calories wandered off target. Let's reel them back in." };
      default:
        return { mood: "sad", topic: "idle", line: "A quiet week. Let's give the next one a little more." };
    }
  }
  const focus = input.weakestMetric === "movement" ? "steps" : input.weakestMetric ?? "consistency";
  return { mood: "playful", topic: "idle", line: `Decent week! One push on ${focus} and we're golden.` };
}

const at = (now: Date, hours: number, minutes: number) => {
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * Today's remaining Kimbo check-ins, judged on what's known now. The app reschedules whenever
 * data changes, so a nudge only fires if its gap is still open the last time the app saw it.
 */
export function planKimboNudges(input: KimboDayInput): KimboNudge[] {
  const day = totalsFor(input);
  const nudges: KimboNudge[] = [];

  if (input.meals.length === 0) {
    nudges.push({ id: "breakfast", at: at(input.now, 10, 30), title: "Kimbo is hungry", body: "Running on empty here. What did you have for breakfast?" });
  }
  if (day.proteinProgress < 0.35) {
    nudges.push({ id: "protein-lunch", at: at(input.now, 13, 30), title: "Protein check", body: `Still ${fmt(day.proteinLeft)} g of protein to go. Lunch is your moment!` });
  }
  if (day.stepProgress < 0.5 && !input.isWalking) {
    nudges.push({ id: "movement", at: at(input.now, 17, 30), title: "Kimbo wants a walk", body: `${fmt(day.stepsLeft)} steps left. Twenty minutes and I stop sulking.` });
  }
  if (day.proteinProgress < 0.7) {
    nudges.push({ id: "protein-dinner", at: at(input.now, 20, 0), title: "Who will cover today's protein?", body: `${fmt(day.proteinLeft)} g still missing. Dinner, it's on you.` });
  }

  return nudges.filter((nudge) => nudge.at.getTime() > input.now.getTime());
}
