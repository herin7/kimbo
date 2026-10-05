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

const profiles = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Ananya Shah", email: "ananya@kimbo.demo", goalType: "lose" as const, current: 72, target: 66, height: 164, age: 26, calories: 1_850, protein: 105, steps: 8_000, adherence: [0.92, 0.84, 0.96, 0.78, 0.9, 1.03, 0.72] },
  { id: "10000000-0000-4000-8000-000000000002", name: "Rohan Mehta", email: "rohan@kimbo.demo", goalType: "maintain" as const, current: 78, target: 78, height: 178, age: 29, calories: 2_300, protein: 120, steps: 10_000, adherence: [0.88, 0.94, 0.9, 1.01, 0.86, 0.97, 0.82] },
  { id: "10000000-0000-4000-8000-000000000003", name: "Mira Kapoor", email: "mira@kimbo.demo", goalType: "gain" as const, current: 55, target: 60, height: 168, age: 24, calories: 2_450, protein: 130, steps: 8_500, adherence: [0.76, 0.89, 0.95, 0.83, 0.98, 0.91, 0.8] },
];

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

      // Keep a full year of lightweight daily history for range and calendar stress-testing.
      // Detailed meals/walks stay limited to the latest week so login payloads remain small.
      for (let index = 0; index < 365; index += 1) {
        const date = dateForOffset(index - 364);
        const recentIndex = index - 358;
        const isRecentWeek = recentIndex >= 0;
        const baseline = profile.adherence[(isRecentWeek ? recentIndex : index) % profile.adherence.length] ?? 0.8;
        const seasonalShift = Math.sin(index / 23) * 0.09 + ((index % 9) - 4) * 0.008;
        const ratio = isRecentWeek ? baseline : Math.max(0.5, Math.min(1.08, baseline + seasonalShift));
        const hasData = isRecentWeek || (index % 13 !== 0 && index % 29 !== 0);
        const calories = Math.round(profile.calories * ratio);
        const protein = Math.round(profile.protein * Math.min(1.05, ratio + 0.08));
        const steps = Math.round(profile.steps * Math.min(1.12, ratio + (index % 2 === 0 ? 0.08 : -0.03)));
        await tx.insert(dailyHealthSummaries).values({
          userId: profile.id,
          date,
          calories: hasData ? calories : 0,
          proteinGrams: hasData ? protein : 0,
          steps: hasData ? steps : null,
          hasMealData: hasData,
          hasActivityData: hasData,
        });

        if (!isRecentWeek) continue;

        const mealsForDay = [
          { type: "breakfast" as const, hour: "08:30:00", name: recentIndex % 2 === 0 ? "Masala omelette and toast" : "Greek yoghurt fruit bowl", share: 0.28, proteinShare: 0.3 },
          { type: "lunch" as const, hour: "13:00:00", name: recentIndex % 3 === 0 ? "Paneer rice bowl" : "Dal, roti and salad", share: 0.4, proteinShare: 0.42 },
          { type: "dinner" as const, hour: "20:00:00", name: recentIndex % 2 === 0 ? "Grilled chicken and vegetables" : "Tofu curry and rice", share: 0.32, proteinShare: 0.28 },
        ];
        for (const sample of mealsForDay) {
          const mealId = randomUUID();
          const mealCalories = Math.round(calories * sample.share);
          const mealProtein = Math.round(protein * sample.proteinShare);
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

        if (recentIndex < 6) {
          await tx.insert(activitySessions).values({
            id: randomUUID(),
            userId: profile.id,
            type: "walking",
            state: "ended",
            startedAt: new Date(`${date}T18:00:00+05:30`),
            endedAt: new Date(`${date}T18:32:00+05:30`),
            startingSteps: 0,
            currentSteps: steps,
            endingSteps: steps,
            estimatedDistanceMeters: Math.round(steps * 0.76),
          });
        }
      }
    });
  }
  console.log("Seeded 3 Kimbo reviewer accounts.");
} finally {
  await close();
}
