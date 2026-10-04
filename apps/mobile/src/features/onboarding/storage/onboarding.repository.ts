import { HealthGoalSchema, type HealthGoal } from "@kimbo/contracts";
import Storage from "expo-sqlite/kv-store";

import { parseStoredJson } from "@/shared/storage/parse-stored-json";

const HEALTH_GOAL_KEY = "kimbo.health-goal.v1";

export interface OnboardingRepository {
  getHealthGoal(): Promise<HealthGoal | null>;
  saveHealthGoal(goal: HealthGoal): Promise<void>;
}

class SQLiteOnboardingRepository implements OnboardingRepository {
  async getHealthGoal(): Promise<HealthGoal | null> {
    const stored = await Storage.getItem(HEALTH_GOAL_KEY);

    if (!stored) {
      return null;
    }

    const parsed = parseStoredJson(stored, HealthGoalSchema);

    if (!parsed) {
      await Storage.removeItem(HEALTH_GOAL_KEY);
      return null;
    }

    return parsed;
  }

  async saveHealthGoal(goal: HealthGoal): Promise<void> {
    await Storage.setItem(HEALTH_GOAL_KEY, JSON.stringify(goal));
  }
}

export const onboardingRepository: OnboardingRepository =
  new SQLiteOnboardingRepository();
