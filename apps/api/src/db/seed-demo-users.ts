import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { createDatabase } from "./database.js";
import { activitySessions, authSessions, dailyHealthSummaries, healthGoals, mealItems, meals, users } from "./schema.js";
import { hashPassword } from "../modules/auth/password.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const DEMO_PASSWORD = "KimboDemo!";
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const dateForOffset = (offset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return formatter.format(date);
};

type ReviewerProfile = {
  id: string;
  name: string;
  email: string;
  goalType: "lose" | "maintain" | "gain";
  current: number;
  target: number;
  height: number;
  age: number;
  calories: number;
  protein: number;
  steps: number;
  trackingStartsOnDay: number;
  travelWeeks: number[];
  calorieBias: number;
  proteinBias: number;
  stepBias: number;
  breakfasts: string[];
  lunches: string[];
  dinners: string[];
  snacks: string[];
};

const profiles: ReviewerProfile[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Ananya Shah",
    email: "ananya@kimbo.demo",
    goalType: "lose",
    current: 72,
    target: 66,
    height: 164,
    age: 26,
    calories: 1_850,
    protein: 105,
    steps: 8_000,
    trackingStartsOnDay: 6,
    travelWeeks: [102, 231],
    calorieBias: 0.98,
    proteinBias: 0.96,
    stepBias: 0.92,
    breakfasts: ["Besan chilla with mint chutney", "Greek yoghurt, berries and granola", "Masala omelette and toast", "Overnight oats with chia"],
    lunches: ["Dal, roti and cucumber salad", "Paneer millet bowl", "Rajma rice with kachumber", "Chicken quinoa salad"],
    dinners: ["Tofu curry with brown rice", "Grilled chicken and vegetables", "Palak paneer with roti", "Lentil soup and sourdough"],
    snacks: ["Apple with peanut butter", "Roasted chana", "Protein yoghurt", "Dark chocolate and almonds"],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Rohan Mehta",
    email: "rohan@kimbo.demo",
    goalType: "maintain",
    current: 78,
    target: 78,
    height: 178,
    age: 29,
    calories: 2_300,
    protein: 120,
    steps: 10_000,
    trackingStartsOnDay: 0,
    travelWeeks: [166],
    calorieBias: 1.01,
    proteinBias: 0.98,
    stepBias: 1.04,
    breakfasts: ["Egg bhurji, toast and fruit", "Peanut butter banana oats", "Idli, sambar and coffee", "Protein smoothie with oats"],
    lunches: ["Chicken rice bowl", "Chole, jeera rice and salad", "Fish curry with rice", "Turkey wrap and fruit"],
    dinners: ["Homemade chicken biryani", "Dal tadka, roti and sabzi", "Pesto pasta with grilled chicken", "Paneer tikka bowl"],
    snacks: ["Whey shake and banana", "Makhana", "Cottage cheese and fruit", "Trail mix"],
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Mira Kapoor",
    email: "mira@kimbo.demo",
    goalType: "gain",
    current: 55,
    target: 60,
    height: 168,
    age: 24,
    calories: 2_450,
    protein: 130,
    steps: 8_500,
    trackingStartsOnDay: 54,
    travelWeeks: [142, 276],
    calorieBias: 1.03,
    proteinBias: 1.04,
    stepBias: 0.86,
    breakfasts: ["Peanut butter oats and milk", "Eggs, toast and avocado", "Paneer paratha with curd", "Protein smoothie bowl"],
    lunches: ["Chicken pulao and raita", "Tofu burrito bowl", "Dal makhani, rice and salad", "Paneer pesto pasta"],
    dinners: ["Salmon, potatoes and greens", "Soya keema with roti", "Chicken stir-fry noodles", "Rajma quesadilla bowl"],
    snacks: ["Whey shake and dates", "Banana with mixed nuts", "Paneer sandwich", "Yoghurt with honey"],
  },
];

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const wave = (day: number, seed: number) => Math.sin(day * 0.43 + seed) * 0.06 + Math.sin(day * 0.11 + seed * 2) * 0.04;
const pick = <T,>(items: T[], index: number) => items[index % items.length] as T;

const createDailyPattern = (profile: ReviewerProfile, day: number) => {
  const weekday = day % 7;
  const weekend = weekday === 5 || weekday === 6;
  const inTravelWeek = profile.travelWeeks.some((start) => day >= start && day < start + 7);
  const hasStarted = day >= profile.trackingStartsOnDay;
  const lowEffortDay = (day + profile.age) % 19 === 0 || (weekend && (day + profile.height) % 5 === 0);
  const hasData = hasStarted && !inTravelWeek && !lowEffortDay;
  const recentMomentum = day > 300 ? 0.035 : day > 180 ? 0.01 : -0.025;
  const restaurantDay = weekend && (day + profile.current) % 4 === 0;
  const workoutDay = (day + profile.height) % 3 === 0 && !weekend;
  const caloriesRatio = clamp(profile.calorieBias + recentMomentum + wave(day, profile.age) + (restaurantDay ? 0.14 : 0) - (workoutDay && profile.goalType === "gain" ? 0 : 0.015), 0.7, 1.24);
  const proteinRatio = clamp(profile.proteinBias + recentMomentum + wave(day, profile.current) * 0.7 - (restaurantDay ? 0.08 : 0), 0.62, 1.16);
  const stepsRatio = clamp(profile.stepBias + wave(day, profile.height) + (workoutDay ? 0.18 : 0) - (weekend ? 0.1 : 0) - (restaurantDay ? 0.05 : 0), 0.42, 1.28);

  return {
    hasData,
    calories: Math.round(profile.calories * caloriesRatio),
    protein: Math.round(profile.protein * proteinRatio),
    steps: Math.round(profile.steps * stepsRatio),
    weekend,
    restaurantDay,
    workoutDay,
  };
};

const { db, close } = createDatabase(databaseUrl);
try {
  for (const profile of profiles) {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        passwordHash: hashPassword(DEMO_PASSWORD),
      }).onConflictDoUpdate({ target: users.id, set: { name: profile.name, email: profile.email, passwordHash: hashPassword(DEMO_PASSWORD) } });

      const oldMeals = await tx.select({ id: meals.id }).from(meals).where(eq(meals.userId, profile.id));
      for (const meal of oldMeals) await tx.delete(mealItems).where(eq(mealItems.mealId, meal.id));
      await tx.delete(authSessions).where(eq(authSessions.userId, profile.id));
      await tx.delete(activitySessions).where(eq(activitySessions.userId, profile.id));
      await tx.delete(dailyHealthSummaries).where(eq(dailyHealthSummaries.userId, profile.id));
      await tx.delete(meals).where(eq(meals.userId, profile.id));

      const goal = {
        userId: profile.id,
        goalType: profile.goalType,
        currentWeightKg: profile.current,
        targetWeightKg: profile.target,
        heightCm: profile.height,
        ageYears: profile.age,
        activityLevel: "moderate" as const,
        dailyCalorieTarget: profile.calories,
        dailyProteinTargetGrams: profile.protein,
        dailyStepTarget: profile.steps,
        timeZone: "Asia/Kolkata",
        updatedAt: new Date(),
      };
      await tx.insert(healthGoals).values(goal).onConflictDoUpdate({ target: healthGoals.userId, set: goal });

      // Each reviewer has a full history, but it includes holidays, low-effort days, weekends,
      // and improving habits instead of a suspiciously perfect pattern. Detailed entries cover
      // the latest two weeks; the rest stays as compact daily summaries for fast login.
      for (let index = 0; index < 365; index += 1) {
        const date = dateForOffset(index - 364);
        const pattern = createDailyPattern(profile, index);
        const recentIndex = index - 351;
        const isDetailedWindow = recentIndex >= 0 && pattern.hasData;
        await tx.insert(dailyHealthSummaries).values({
          userId: profile.id,
          date,
          calories: pattern.hasData ? pattern.calories : 0,
          proteinGrams: pattern.hasData ? pattern.protein : 0,
          steps: pattern.hasData ? pattern.steps : null,
          hasMealData: pattern.hasData,
          hasActivityData: pattern.hasData,
        });

        if (!isDetailedWindow) continue;

        const includesSnack = (index + profile.age) % 3 !== 0;
        const dinnerShare = 1 - 0.25 - 0.39 - (includesSnack ? 0.06 : 0);
        const mealsForDay: Array<{ type: "breakfast" | "lunch" | "dinner" | "snack"; hour: string; name: string; share: number; proteinShare: number }> = [
          { type: "breakfast" as const, hour: pattern.weekend ? "09:20:00" : "08:10:00", name: pick(profile.breakfasts, index), share: 0.25, proteinShare: 0.25 },
          { type: "lunch" as const, hour: "13:15:00", name: pick(profile.lunches, index + 1), share: 0.39, proteinShare: 0.42 },
          { type: "dinner" as const, hour: pattern.weekend ? "20:45:00" : "20:10:00", name: pattern.restaurantDay ? "Restaurant meal with friends" : pick(profile.dinners, index + 2), share: dinnerShare, proteinShare: pattern.restaurantDay ? 0.33 : 0.28 },
        ];
        if (includesSnack) {
          mealsForDay.push({ type: "snack", hour: "16:45:00", name: pick(profile.snacks, index + 3), share: 0.06, proteinShare: 0.05 });
        }
        for (const sample of mealsForDay) {
          const mealId = randomUUID();
          const mealCalories = Math.round(pattern.calories * sample.share);
          const mealProtein = Math.round(pattern.protein * sample.proteinShare);
          await tx.insert(meals).values({
            id: mealId,
            userId: profile.id,
            mealType: sample.type,
            source: recentIndex % 3 === 0 ? "image" : recentIndex % 2 === 0 ? "voice" : "manual",
            totalCalories: mealCalories,
            totalProteinGrams: mealProtein,
            totalCarbsGrams: Math.round(mealCalories * 0.11),
            totalFatGrams: Math.round(mealCalories * 0.035),
            occurredAt: new Date(`${date}T${sample.hour}+05:30`),
            timeZone: "Asia/Kolkata",
          });
          await tx.insert(mealItems).values({
            mealId,
            name: sample.name,
            portionAmount: 1,
            portionUnit: "serving",
            portionDisplayText: "1 serving",
            calories: mealCalories,
            proteinGrams: mealProtein,
            carbsGrams: Math.round(mealCalories * 0.11),
            fatGrams: Math.round(mealCalories * 0.035),
            confidence: 0.94,
          });
        }

        if (pattern.workoutDay || recentIndex % 3 !== 0) {
          const walkingSteps = Math.round(pattern.steps * (pattern.workoutDay ? 0.5 : 0.32));
          const startingSteps = Math.max(0, pattern.steps - walkingSteps);
          await tx.insert(activitySessions).values({
            id: randomUUID(),
            userId: profile.id,
            type: "walking",
            state: "ended",
            startedAt: new Date(`${date}T${pattern.weekend ? "08:15:00" : "18:25:00"}+05:30`),
            endedAt: new Date(`${date}T${pattern.weekend ? "09:03:00" : "19:02:00"}+05:30`),
            startingSteps,
            currentSteps: pattern.steps,
            endingSteps: pattern.steps,
            estimatedDistanceMeters: Math.round(walkingSteps * 0.76),
          });
        }
      }
    });
  }
  console.log("Seeded 3 Kimbo reviewer accounts.");
} finally {
  await close();
}
