import { randomBytes, createHash } from "node:crypto";
import type { ActivitySession, ConfirmedMeal, HealthGoal, LoginRequest, LoginResponse, UserProfile } from "@kimbo/contracts";
import { and, eq, gt } from "drizzle-orm";

import type { Database } from "../../db/database.js";
import { activitySessions, authSessions, healthGoals, mealItems, meals, users } from "../../db/schema.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthRepository } from "./AuthRepository.js";
import { verifyPassword } from "./password.js";

const SESSION_DAYS = 14;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly db: Database) {}

  async login(input: LoginRequest): Promise<LoginResponse> {
    const [row] = await this.db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
    if (!row?.email || !row.name || !row.passwordHash || !verifyPassword(input.password, row.passwordHash)) {
      throw new AppError("UNAUTHORIZED", "Email or password is incorrect", 401, false);
    }

    const [goalRow] = await this.db.select().from(healthGoals).where(eq(healthGoals.userId, row.id)).limit(1);
    if (!goalRow) throw new AppError("NOT_FOUND", "This demo account is not ready", 404, false);

    const mealRows = await this.db.select().from(meals).where(eq(meals.userId, row.id));
    const itemRows = mealRows.length === 0
      ? []
      : (await Promise.all(mealRows.map((meal) => this.db.select().from(mealItems).where(eq(mealItems.mealId, meal.id))))).flat();
    const sessionRows = await this.db.select().from(activitySessions).where(eq(activitySessions.userId, row.id));

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1_000);
    await this.db.insert(authSessions).values({ tokenHash: tokenHash(token), userId: row.id, expiresAt });

    const user: UserProfile = { id: row.id, name: row.name, email: row.email, createdAt: row.createdAt.toISOString() };
    const goal: HealthGoal = {
      goalType: goalRow.goalType,
      currentWeightKg: goalRow.currentWeightKg,
      targetWeightKg: goalRow.targetWeightKg,
      heightCm: goalRow.heightCm,
      ageYears: goalRow.ageYears,
      activityLevel: goalRow.activityLevel,
      dailyCalorieTarget: goalRow.dailyCalorieTarget,
      dailyProteinTargetGrams: goalRow.dailyProteinTargetGrams,
      dailyStepTarget: goalRow.dailyStepTarget,
      timeZone: goalRow.timeZone,
      updatedAt: goalRow.updatedAt.toISOString(),
    };
    const confirmedMeals: ConfirmedMeal[] = mealRows.map((meal) => ({
      id: meal.id,
      mealType: meal.mealType,
      source: meal.source,
      occurredAt: meal.occurredAt.toISOString(),
      timeZone: meal.timeZone,
      syncStatus: "synced",
      totals: {
        calories: meal.totalCalories,
        proteinGrams: meal.totalProteinGrams,
        carbsGrams: meal.totalCarbsGrams,
        fatGrams: meal.totalFatGrams,
      },
      items: itemRows.filter((item) => item.mealId === meal.id).map((item) => ({
        id: item.id,
        name: item.name,
        portion: { amount: item.portionAmount, unit: item.portionUnit, displayText: item.portionDisplayText },
        nutrition: { calories: item.calories, proteinGrams: item.proteinGrams, carbsGrams: item.carbsGrams, fatGrams: item.fatGrams },
        confidence: item.confidence,
      })),
    }));
    const activities: ActivitySession[] = sessionRows.map((session) => ({
      id: session.id,
      type: "walking",
      state: session.state,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      startingSteps: session.startingSteps,
      currentSteps: session.currentSteps,
      endingSteps: session.endingSteps,
      estimatedDistanceMeters: session.estimatedDistanceMeters,
      syncStatus: "synced",
    }));
    return { token, user, goal, meals: confirmedMeals, activitySessions: activities };
  }

  async authenticate(token: string): Promise<string | null> {
    const [session] = await this.db.select().from(authSessions).where(and(
      eq(authSessions.tokenHash, tokenHash(token)),
      gt(authSessions.expiresAt, new Date()),
    )).limit(1);
    return session?.userId ?? null;
  }
}
