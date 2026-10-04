import { activityRepository } from "@/features/activity/storage/activity.repository";
import { mealRepository } from "@/features/meals/storage/meal.repository";
import { onboardingRepository } from "@/features/onboarding/storage/onboarding.repository";

import { syncActivitySession, syncGoal, syncMeal } from "./health-data.api";

export async function syncPendingData() {
  const [goal, meals, sessions] = await Promise.all([
    onboardingRepository.getHealthGoal(),
    mealRepository.getMeals(),
    activityRepository.getSessions(),
  ]);
  if (goal) await syncGoal(goal).catch(() => undefined);
  for (const meal of meals.filter((item) => item.syncStatus !== "synced")) {
    const synced = await syncMeal(meal).catch(() => null);
    if (synced) await mealRepository.saveMeal(synced);
  }
  for (const session of sessions.filter((item) => item.syncStatus !== "synced" && item.state !== "active")) {
    const synced = await syncActivitySession(session).catch(() => null);
    if (synced) await activityRepository.saveSession(synced);
  }
}
