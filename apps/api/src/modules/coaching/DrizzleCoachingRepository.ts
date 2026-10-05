import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/database.js";
import { dailyHealthSummaries, pushTokens } from "../../db/schema.js";
import type { CoachingRepository, DailySummaryInput } from "./CoachingRepository.js";

export class DrizzleCoachingRepository implements CoachingRepository {
  constructor(private readonly db: Database) {}

  async upsertPushToken(userId: string, token: string) {
    const values = { userId, token, updatedAt: new Date() };
    await this.db.insert(pushTokens).values(values).onConflictDoUpdate({ target: pushTokens.token, set: values });
  }

  async deletePushToken(userId: string, token: string) {
    await this.db.delete(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  }

  async upsertDailySummary(userId: string, date: string, summary: DailySummaryInput) {
    const values = { userId, date, ...summary, updatedAt: new Date() };
    await this.db.insert(dailyHealthSummaries).values(values).onConflictDoUpdate({
      target: [dailyHealthSummaries.userId, dailyHealthSummaries.date],
      set: values,
    });
  }
}
