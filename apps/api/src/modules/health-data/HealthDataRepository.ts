import type { ActivitySession, ConfirmedMeal, CreateMealRequest, HealthGoal } from "@kimbo/contracts";

export interface HealthDataRepository {
  upsertGoal(userId: string, goal: HealthGoal): Promise<HealthGoal>;
  createMeal(userId: string, meal: CreateMealRequest): Promise<ConfirmedMeal>;
  upsertActivitySession(userId: string, session: ActivitySession): Promise<ActivitySession>;
}
