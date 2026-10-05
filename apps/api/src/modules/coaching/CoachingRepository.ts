export interface DailySummaryInput {
  calories: number;
  proteinGrams: number;
  steps: number | null;
  hasMealData: boolean;
  hasActivityData: boolean;
}

export interface CoachingRepository {
  upsertPushToken(userId: string, token: string): Promise<void>;
  deletePushToken(userId: string, token: string): Promise<void>;
  upsertDailySummary(userId: string, date: string, summary: DailySummaryInput): Promise<void>;
}
