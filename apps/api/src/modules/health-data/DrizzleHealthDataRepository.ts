import type { ActivitySession, ConfirmedMeal, CreateMealRequest, HealthGoal } from "@kimbo/contracts";
import { sumNutrition } from "@kimbo/domain";

import type { Database } from "../../db/database.js";
import { activitySessions, healthGoals, mealItems, meals, users } from "../../db/schema.js";
import type { HealthDataRepository } from "./HealthDataRepository.js";

export class DrizzleHealthDataRepository implements HealthDataRepository {
  constructor(private readonly db: Database) {}

  private async ensureUser(userId: string) {
    await this.db.insert(users).values({ id: userId }).onConflictDoNothing();
  }

  async upsertGoal(userId: string, goal: HealthGoal) {
    await this.ensureUser(userId);
    const values = { userId, ...goal, updatedAt: new Date(goal.updatedAt) };
    await this.db.insert(healthGoals).values(values).onConflictDoUpdate({ target: healthGoals.userId, set: values });
    return goal;
  }

  async createMeal(userId: string, meal: CreateMealRequest): Promise<ConfirmedMeal> {
    await this.ensureUser(userId);
    const totals = sumNutrition(meal.items);
    await this.db.transaction(async (transaction) => {
      const inserted = await transaction.insert(meals).values({
        id: meal.id,
        userId,
        mealType: meal.mealType,
        source: meal.source,
        totalCalories: totals.calories,
        totalProteinGrams: totals.proteinGrams,
        totalCarbsGrams: totals.carbsGrams,
        totalFatGrams: totals.fatGrams,
        occurredAt: new Date(meal.occurredAt),
        timeZone: meal.timeZone,
      }).onConflictDoNothing().returning({ id: meals.id });
      if (inserted.length > 0) {
        await transaction.insert(mealItems).values(meal.items.map((item) => ({
          id: item.id,
          mealId: meal.id,
          name: item.name,
          portionAmount: item.portion.amount,
          portionUnit: item.portion.unit,
          portionDisplayText: item.portion.displayText,
          calories: item.nutrition.calories,
          proteinGrams: item.nutrition.proteinGrams,
          carbsGrams: item.nutrition.carbsGrams,
          fatGrams: item.nutrition.fatGrams,
          confidence: item.confidence,
        })));
      }
    });
    return { ...meal, totals, syncStatus: "synced" };
  }

  async upsertActivitySession(userId: string, session: ActivitySession) {
    await this.ensureUser(userId);
    const values = {
      id: session.id,
      userId,
      type: session.type,
      state: session.state,
      startedAt: new Date(session.startedAt),
      endedAt: session.endedAt ? new Date(session.endedAt) : null,
      startingSteps: session.startingSteps,
      currentSteps: session.currentSteps,
      endingSteps: session.endingSteps,
      estimatedDistanceMeters: session.estimatedDistanceMeters,
    };
    await this.db.insert(activitySessions).values(values).onConflictDoUpdate({ target: activitySessions.id, set: values });
    return { ...session, syncStatus: "synced" as const };
  }
}
