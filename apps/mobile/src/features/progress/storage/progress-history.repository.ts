import { DailyHealthSummarySchema, type DailyHealthSummary } from "@kimbo/contracts";
import Storage from "expo-sqlite/kv-store";
import { z } from "zod";

import { parseStoredJson } from "@/shared/storage/parse-stored-json";

const KEY = "kimbo.daily-health-summaries.v1";
const SummariesSchema = z.array(DailyHealthSummarySchema);
export const progressHistoryQueryKey = ["progress", "daily-history"] as const;

class ProgressHistoryRepository {
  async getSummaries(): Promise<DailyHealthSummary[]> {
    const stored = await Storage.getItem(KEY);
    if (!stored) return [];
    const parsed = parseStoredJson(stored, SummariesSchema);
    if (parsed) return parsed;
    await Storage.removeItem(KEY);
    return [];
  }

  async replaceSummaries(summaries: DailyHealthSummary[]) {
    await Storage.setItem(KEY, JSON.stringify(summaries));
  }

  async clear() {
    await Storage.removeItem(KEY);
  }
}

export const progressHistoryRepository = new ProgressHistoryRepository();
