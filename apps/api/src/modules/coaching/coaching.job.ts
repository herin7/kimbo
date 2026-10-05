import type { DailyHealthSummary } from "@kimbo/contracts";
import { buildWeeklyReflection, evaluateDay, localClock, selectNotification, type CoachingDay, type Insight } from "@kimbo/domain";
import { and, asc, eq, gte, lte } from "drizzle-orm";

import type { Database } from "../../db/database.js";
import { coachingNotifications, dailyHealthSummaries, healthGoals, meals, pushTokens } from "../../db/schema.js";

export interface CoachingJobUser {
  userId: string;
  token: string;
  timeZone: string;
  day: CoachingDay;
  sentToday: { key: string; kind: Insight["kind"]; minute: number }[];
  week: DailyHealthSummary[];
  previousWeek: DailyHealthSummary[];
}

export interface CoachingJobSource {
  load(now: Date): Promise<CoachingJobUser[]>;
  markSent(userId: string, insight: Insight, localDate: string, sentAt: Date): Promise<void>;
  deleteToken(userId: string, token: string): Promise<void>;
}

const dateOffset = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const emptySummary = (date: string, goal: { dailyCalorieTarget: number; dailyProteinTargetGrams: number; dailyStepTarget: number }): DailyHealthSummary => ({
  date,
  calories: 0,
  calorieTarget: goal.dailyCalorieTarget,
  proteinGrams: 0,
  proteinTargetGrams: goal.dailyProteinTargetGrams,
  steps: null,
  stepTarget: goal.dailyStepTarget,
  hasMealData: false,
  hasActivityData: false,
});

class DrizzleCoachingJobSource implements CoachingJobSource {
  constructor(private readonly db: Database) {}

  async load(now: Date): Promise<CoachingJobUser[]> {
    const recipients = await this.db.select({
      userId: pushTokens.userId,
      token: pushTokens.token,
      timeZone: healthGoals.timeZone,
      dailyCalorieTarget: healthGoals.dailyCalorieTarget,
      dailyProteinTargetGrams: healthGoals.dailyProteinTargetGrams,
      dailyStepTarget: healthGoals.dailyStepTarget,
    }).from(pushTokens).innerJoin(healthGoals, eq(pushTokens.userId, healthGoals.userId));

    return Promise.all(recipients.map(async (recipient) => {
      const clock = localClock(now, recipient.timeZone);
      const startDate = dateOffset(clock.date, -13);
      const mealWindowStart = new Date(now.getTime() - 36 * 60 * 60_000);
      const [mealRows, summaryRows, sentRows] = await Promise.all([
        this.db.select({ occurredAt: meals.occurredAt, calories: meals.totalCalories, proteinGrams: meals.totalProteinGrams })
          .from(meals).where(and(eq(meals.userId, recipient.userId), gte(meals.occurredAt, mealWindowStart))),
        this.db.select().from(dailyHealthSummaries).where(and(
          eq(dailyHealthSummaries.userId, recipient.userId),
          gte(dailyHealthSummaries.date, startDate),
          lte(dailyHealthSummaries.date, clock.date),
        )).orderBy(asc(dailyHealthSummaries.date)),
        this.db.select().from(coachingNotifications).where(and(
          eq(coachingNotifications.userId, recipient.userId),
          eq(coachingNotifications.localDate, clock.date),
        )),
      ]);

      const todayMeals = mealRows.filter((meal) => localClock(meal.occurredAt, recipient.timeZone).date === clock.date);
      const todayStored = summaryRows.find((summary) => summary.date === clock.date);
      const mealCalories = todayMeals.reduce((sum, meal) => sum + meal.calories, 0);
      const mealProtein = todayMeals.reduce((sum, meal) => sum + meal.proteinGrams, 0);
      const isFresh = todayStored ? now.getTime() - todayStored.updatedAt.getTime() <= 90 * 60_000 : false;
      const goal = recipient;
      const byDate = new Map(summaryRows.map((summary) => [summary.date, {
        date: summary.date,
        calories: summary.calories,
        calorieTarget: goal.dailyCalorieTarget,
        proteinGrams: summary.proteinGrams,
        proteinTargetGrams: goal.dailyProteinTargetGrams,
        steps: summary.steps,
        stepTarget: goal.dailyStepTarget,
        hasMealData: summary.hasMealData,
        hasActivityData: summary.hasActivityData,
      } satisfies DailyHealthSummary]));
      const today: DailyHealthSummary = {
        date: clock.date,
        calories: Math.max(todayStored?.calories ?? 0, Math.round(mealCalories)),
        calorieTarget: goal.dailyCalorieTarget,
        proteinGrams: Math.max(todayStored?.proteinGrams ?? 0, mealProtein),
        proteinTargetGrams: goal.dailyProteinTargetGrams,
        steps: isFresh ? todayStored?.steps ?? null : null,
        stepTarget: goal.dailyStepTarget,
        hasMealData: todayMeals.length > 0 || todayStored?.hasMealData === true,
        hasActivityData: isFresh && todayStored?.hasActivityData === true,
      };
      byDate.set(clock.date, today);
      const fourteen = Array.from({ length: 14 }, (_, index) => {
        const date = dateOffset(clock.date, index - 13);
        return byDate.get(date) ?? emptySummary(date, goal);
      });
      const sentToday = sentRows.map((entry) => ({
        key: entry.key,
        kind: entry.kind as Insight["kind"],
        minute: localClock(entry.sentAt, recipient.timeZone).minute,
      }));
      return {
        userId: recipient.userId,
        token: recipient.token,
        timeZone: recipient.timeZone,
        day: {
          ...clock,
          calorieTarget: goal.dailyCalorieTarget,
          proteinTargetGrams: goal.dailyProteinTargetGrams,
          stepTarget: goal.dailyStepTarget,
          meals: todayMeals.map((meal) => ({ minute: localClock(meal.occurredAt, recipient.timeZone).minute, calories: meal.calories, proteinGrams: meal.proteinGrams })),
          steps: today.steps,
          history: fourteen.slice(0, -1),
          sentToday: sentToday.map((entry) => entry.key),
        },
        sentToday,
        week: fourteen.slice(-7),
        previousWeek: fourteen.slice(0, 7),
      };
    }));
  }

  async markSent(userId: string, insight: Insight, localDate: string, sentAt: Date) {
    await this.db.insert(coachingNotifications).values({ userId, key: insight.key, kind: insight.kind, localDate, sentAt }).onConflictDoNothing();
  }

  async deleteToken(userId: string, token: string) {
    await this.db.delete(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  }
}

interface PushTicket { status: "ok" | "error"; details?: { error?: string } }

const channelFor = (insight: Insight) => insight.kind === "weekly" ? "kimbo-weekly" : insight.kind === "feedback" ? "kimbo-wins" : "kimbo-coaching";
const categoryFor = (insight: Insight) => insight.kind === "weekly" ? "weekly" : insight.kind === "feedback" ? "wins" : insight.topic === "movement" ? "steps" : insight.topic === "protein" ? "protein" : "calories";

export async function runCoaching(
  db: Database,
  now = new Date(),
  dependencies: { source?: CoachingJobSource; fetch?: typeof fetch; apiUrl?: string } = {},
) {
  const source = dependencies.source ?? new DrizzleCoachingJobSource(db);
  const fetcher = dependencies.fetch ?? fetch;
  const apiUrl = (dependencies.apiUrl ?? process.env.API_URL ?? process.env.EXPO_PUBLIC_API_URL)?.replace(/\/$/, "");
  const users = await source.load(now);
  const deliveries = users.flatMap((user) => {
    const insights = evaluateDay(user.day);
    if (user.day.weekday === 0 && user.day.minute >= 1_140) insights.push(buildWeeklyReflection(user.week, user.previousWeek));
    insights.sort((a, b) => b.priority - a.priority);
    const insight = selectNotification(insights, { minute: user.day.minute, sentToday: user.sentToday });
    return insight ? [{ user, insight }] : [];
  });

  let sent = 0;
  for (let offset = 0; offset < deliveries.length; offset += 100) {
    const chunk = deliveries.slice(offset, offset + 100);
    const messages = chunk.map(({ user, insight }) => ({
      to: user.token,
      title: insight.title,
      body: `${insight.explanation} ${insight.action.label}`,
      channelId: channelFor(insight),
      categoryId: categoryFor(insight),
      priority: "high",
      data: { url: `kimbo://${insight.action.route.replace(/^\//, "")}`, key: insight.key },
      ...(apiUrl ? { richContent: { image: `${apiUrl}/v1/notification-art/${insight.type}.png` } } : {}),
    }));
    const response = await fetcher("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!response.ok) continue;
    const result = await response.json() as { data?: PushTicket[] };
    for (let index = 0; index < chunk.length; index += 1) {
      const delivery = chunk[index]!;
      const ticket = result.data?.[index];
      if (ticket?.status === "ok") {
        await source.markSent(delivery.user.userId, delivery.insight, delivery.user.day.date, now);
        sent += 1;
      } else if (ticket?.details?.error === "DeviceNotRegistered") {
        await source.deleteToken(delivery.user.userId, delivery.user.token);
      }
    }
  }
  return { evaluated: users.length, eligible: deliveries.length, sent };
}
