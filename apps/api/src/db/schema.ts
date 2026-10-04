import { boolean, date, doublePrecision, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const goalType = pgEnum("goal_type", ["lose", "maintain", "gain"]);
export const activityLevel = pgEnum("activity_level", ["sedentary", "light", "moderate", "very_active"]);
export const mealType = pgEnum("meal_type", ["breakfast", "lunch", "dinner", "snack"]);
export const mealSource = pgEnum("meal_source", ["voice", "image", "manual"]);
export const sessionState = pgEnum("activity_session_state", ["active", "ended", "interrupted"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const authSessions = pgTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const healthGoals = pgTable("health_goals", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  goalType: goalType("goal_type").notNull(),
  currentWeightKg: doublePrecision("current_weight_kg").notNull(),
  targetWeightKg: doublePrecision("target_weight_kg").notNull(),
  heightCm: doublePrecision("height_cm").notNull(),
  ageYears: integer("age_years").notNull(),
  activityLevel: activityLevel("activity_level").notNull(),
  dailyCalorieTarget: integer("daily_calorie_target").notNull(),
  dailyProteinTargetGrams: integer("daily_protein_target_grams").notNull(),
  dailyStepTarget: integer("daily_step_target").notNull(),
  timeZone: text("time_zone").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const meals = pgTable("meals", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mealType: mealType("meal_type").notNull(),
  source: mealSource("source").notNull(),
  totalCalories: doublePrecision("total_calories").notNull(),
  totalProteinGrams: doublePrecision("total_protein_grams").notNull(),
  totalCarbsGrams: doublePrecision("total_carbs_grams").notNull(),
  totalFatGrams: doublePrecision("total_fat_grams").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  timeZone: text("time_zone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mealItems = pgTable("meal_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealId: uuid("meal_id").notNull().references(() => meals.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  portionAmount: doublePrecision("portion_amount").notNull(),
  portionUnit: text("portion_unit").notNull(),
  portionDisplayText: text("portion_display_text").notNull(),
  calories: doublePrecision("calories").notNull(),
  proteinGrams: doublePrecision("protein_grams").notNull(),
  carbsGrams: doublePrecision("carbs_grams").notNull(),
  fatGrams: doublePrecision("fat_grams").notNull(),
  confidence: doublePrecision("confidence").notNull(),
});

export const activitySessions = pgTable("activity_sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  state: sessionState("state").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  startingSteps: integer("starting_steps").notNull(),
  currentSteps: integer("current_steps").notNull(),
  endingSteps: integer("ending_steps"),
  estimatedDistanceMeters: doublePrecision("estimated_distance_meters"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyHealthSummaries = pgTable("daily_health_summaries", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  calories: integer("calories").notNull().default(0),
  proteinGrams: doublePrecision("protein_grams").notNull().default(0),
  steps: integer("steps"),
  hasMealData: boolean("has_meal_data").notNull().default(false),
  hasActivityData: boolean("has_activity_data").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.date] })]);
