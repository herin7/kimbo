import { z } from "zod";

export const GoalTypeSchema = z.enum(["lose", "maintain", "gain"]);
export type GoalType = z.infer<typeof GoalTypeSchema>;

export const ActivityLevelSchema = z.enum([
  "sedentary",
  "light",
  "moderate",
  "very_active",
]);
export type ActivityLevel = z.infer<typeof ActivityLevelSchema>;

export const MealTypeSchema = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);
export type MealType = z.infer<typeof MealTypeSchema>;

export const MealSourceSchema = z.enum(["voice", "image", "manual"]);
export type MealSource = z.infer<typeof MealSourceSchema>;

export const SyncStatusSchema = z.enum(["synced", "pending", "failed"]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const TimestampSchema = z.string().datetime({ offset: true });

export const NutritionSchema = z.object({
  calories: z.number().finite().nonnegative().max(20_000),
  proteinGrams: z.number().finite().nonnegative().max(2_000),
  carbsGrams: z.number().finite().nonnegative().max(3_000),
  fatGrams: z.number().finite().nonnegative().max(1_000),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

export const PortionSchema = z.object({
  amount: z.number().finite().positive().max(10_000),
  unit: z.string().trim().min(1).max(32),
  displayText: z.string().trim().min(1).max(80),
});
export type Portion = z.infer<typeof PortionSchema>;

export const MealItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  portion: PortionSchema,
  nutrition: NutritionSchema,
  confidence: z.number().finite().min(0).max(1),
});
export type MealItem = z.infer<typeof MealItemSchema>;

export const MealAnalysisResultSchema = z.object({
  items: z.array(MealItemSchema).min(1).max(20),
  overallConfidence: z.number().finite().min(0).max(1),
  warnings: z.array(z.string().trim().min(1).max(240)).max(5).default([]),
});
export type MealAnalysisResult = z.infer<typeof MealAnalysisResultSchema>;

export const MealDraftSchema = z.object({
  id: z.string().uuid(),
  mealType: MealTypeSchema,
  source: MealSourceSchema,
  items: z.array(MealItemSchema).min(1).max(50),
  occurredAt: TimestampSchema,
});
export type MealDraft = z.infer<typeof MealDraftSchema>;

export const AnalyseTextMealRequestSchema = z.object({
  text: z.string().trim().min(2).max(2_000),
  locale: z.string().trim().min(2).max(24).default("en-IN"),
});
export type AnalyseTextMealRequest = z.infer<typeof AnalyseTextMealRequestSchema>;

export const MealTranscriptionResponseSchema = z.object({
  transcript: z.string().trim().min(1).max(5_000),
  languageCode: z.string().trim().min(2).max(24).nullable(),
});
export type MealTranscriptionResponse = z.infer<typeof MealTranscriptionResponseSchema>;

export const CreateMealRequestSchema = z.object({
  id: z.string().uuid(),
  mealType: MealTypeSchema,
  source: MealSourceSchema,
  items: z.array(MealItemSchema).min(1).max(50),
  occurredAt: TimestampSchema,
  timeZone: z.string().trim().min(1).max(64),
});
export type CreateMealRequest = z.infer<typeof CreateMealRequestSchema>;

export const ConfirmedMealSchema = CreateMealRequestSchema.extend({
  totals: NutritionSchema,
  syncStatus: SyncStatusSchema,
});
export type ConfirmedMeal = z.infer<typeof ConfirmedMealSchema>;

export const HealthGoalInputSchema = z
  .object({
    goalType: GoalTypeSchema,
    currentWeightKg: z.number().finite().min(30).max(350),
    targetWeightKg: z.number().finite().min(30).max(350),
    heightCm: z.number().finite().min(100).max(250),
    ageYears: z.number().int().min(18).max(100),
    activityLevel: ActivityLevelSchema,
    timeZone: z.string().trim().min(1).max(64),
  })
  .superRefine((goal, context) => {
    if (goal.goalType === "lose" && goal.targetWeightKg >= goal.currentWeightKg) {
      context.addIssue({
        code: "custom",
        path: ["targetWeightKg"],
        message: "A weight-loss target must be below current weight",
      });
    }

    if (goal.goalType === "gain" && goal.targetWeightKg <= goal.currentWeightKg) {
      context.addIssue({
        code: "custom",
        path: ["targetWeightKg"],
        message: "A weight-gain target must be above current weight",
      });
    }
  });
export type HealthGoalInput = z.infer<typeof HealthGoalInputSchema>;

export const HealthGoalSchema = HealthGoalInputSchema.and(
  z.object({
    dailyCalorieTarget: z.number().int().min(1_200).max(5_000),
    dailyProteinTargetGrams: z.number().int().min(30).max(300),
    dailyStepTarget: z.number().int().min(1_000).max(50_000),
    updatedAt: TimestampSchema,
  }),
);
export type HealthGoal = z.infer<typeof HealthGoalSchema>;

export const ActivitySessionStateSchema = z.enum([
  "active",
  "ended",
  "interrupted",
]);

export const ActivitySessionSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("walking"),
  state: ActivitySessionStateSchema,
  startedAt: TimestampSchema,
  endedAt: TimestampSchema.nullable(),
  startingSteps: z.number().int().nonnegative(),
  currentSteps: z.number().int().nonnegative(),
  endingSteps: z.number().int().nonnegative().nullable(),
  estimatedDistanceMeters: z.number().finite().nonnegative().nullable(),
  syncStatus: SyncStatusSchema,
});
export type ActivitySession = z.infer<typeof ActivitySessionSchema>;

export const DailyHealthSummarySchema = z.object({
  date: LocalDateSchema,
  calories: z.number().int().nonnegative(),
  calorieTarget: z.number().int().positive(),
  proteinGrams: z.number().nonnegative(),
  proteinTargetGrams: z.number().positive(),
  steps: z.number().int().nonnegative().nullable(),
  stepTarget: z.number().int().positive(),
  hasMealData: z.boolean(),
  hasActivityData: z.boolean(),
});
export type DailyHealthSummary = z.infer<typeof DailyHealthSummarySchema>;

export const TodayResponseSchema = z.object({
  summary: DailyHealthSummarySchema,
  meals: z.array(ConfirmedMealSchema),
  activeActivity: ActivitySessionSchema.nullable(),
});
export type TodayResponse = z.infer<typeof TodayResponseSchema>;

export const InsightFactsSchema = z.object({
  daysWithData: z.number().int().min(0).max(7),
  daysWithinCalorieGoal: z.number().int().min(0).max(7),
  averageSteps: z.number().int().nonnegative().nullable(),
  averageStepGap: z.number().int().nonnegative().nullable(),
  estimatedWalkMinutes: z.number().int().nonnegative().nullable(),
  weakestMetric: z.enum(["calories", "movement", "protein"]).nullable(),
});
export type InsightFacts = z.infer<typeof InsightFactsSchema>;

export const WeeklyProgressSchema = z.object({
  weekStart: LocalDateSchema,
  weekEnd: LocalDateSchema,
  days: z.array(DailyHealthSummarySchema).length(7),
  adherence: z.object({
    caloriesPercent: z.number().int().min(0).max(100),
    movementPercent: z.number().int().min(0).max(100),
    proteinPercent: z.number().int().min(0).max(100),
  }),
  insight: z.object({
    facts: InsightFactsSchema,
    message: z.string().trim().min(1).max(700),
  }),
});
export type WeeklyProgress = z.infer<typeof WeeklyProgressSchema>;

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "NETWORK_ERROR",
  "AI_UNAVAILABLE",
  "INVALID_AI_RESPONSE",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
    retryable: z.boolean(),
    requestId: z.string().min(1),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
