import { ActivitySessionSchema, ConfirmedMealSchema, HealthGoalSchema, type ActivitySession, type ConfirmedMeal, type HealthGoal } from "@kimbo/contracts";
import { z } from "zod";

import { getOrCreateUserId } from "../storage/identity.repository";
import { apiRequest } from "./api-client";

const jsonHeaders = { "content-type": "application/json" };
const OkSchema = z.object({ ok: z.literal(true) });

export async function syncGoal(goal: HealthGoal) {
  const userId = await getOrCreateUserId();
  return apiRequest(`/v1/users/${userId}/goal`, HealthGoalSchema, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(goal) });
}

export async function syncMeal(meal: ConfirmedMeal) {
  const userId = await getOrCreateUserId();
  const { totals: _totals, syncStatus: _syncStatus, ...request } = meal;
  return apiRequest(`/v1/users/${userId}/meals`, ConfirmedMealSchema, { method: "POST", headers: jsonHeaders, body: JSON.stringify(request) });
}

export async function syncActivitySession(session: ActivitySession) {
  const userId = await getOrCreateUserId();
  return apiRequest(`/v1/users/${userId}/activity-sessions/${session.id}`, ActivitySessionSchema, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(session) });
}

export async function registerPushToken(token: string) {
  const userId = await getOrCreateUserId();
  return apiRequest(`/v1/users/${userId}/push-token`, OkSchema, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ token }) });
}

export async function unregisterPushToken(token: string) {
  const userId = await getOrCreateUserId();
  return apiRequest(`/v1/users/${userId}/push-token/${encodeURIComponent(token)}`, OkSchema, { method: "DELETE" });
}

export async function syncDailySummary(date: string, summary: { calories: number; proteinGrams: number; steps: number | null; hasMealData: boolean; hasActivityData: boolean }) {
  const userId = await getOrCreateUserId();
  return apiRequest(`/v1/users/${userId}/daily-summaries/${date}`, OkSchema, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(summary) });
}
