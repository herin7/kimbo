import { ActivitySessionSchema, type ActivitySession } from "@kimbo/contracts";
import Storage from "expo-sqlite/kv-store";
import { z } from "zod";

import { parseStoredJson } from "@/shared/storage/parse-stored-json";

const KEY = "kimbo.activity-sessions.v1";
const SessionsSchema = z.array(ActivitySessionSchema);

export interface ActivityRepository {
  getSessions(): Promise<ActivitySession[]>;
  getActiveSession(): Promise<ActivitySession | null>;
  saveSession(session: ActivitySession): Promise<void>;
}

class SQLiteActivityRepository implements ActivityRepository {
  async getSessions() {
    const stored = await Storage.getItem(KEY);
    if (!stored) return [];
    const parsed = parseStoredJson(stored, SessionsSchema);
    if (parsed) return parsed;
    await Storage.removeItem(KEY);
    return [];
  }

  async getActiveSession() {
    const sessions = await this.getSessions();
    return sessions.find((session) => session.state === "active") ?? null;
  }

  async saveSession(session: ActivitySession) {
    const sessions = await this.getSessions();
    const index = sessions.findIndex((existing) => existing.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
    await Storage.setItem(KEY, JSON.stringify(sessions));
  }
}

export const activityRepository: ActivityRepository = new SQLiteActivityRepository();
