import { ActivitySessionSchema, ConfirmedMealSchema, HealthGoalSchema, type ActivitySession, type ConfirmedMeal, type HealthGoal } from "@kimbo/contracts";

import { getOrCreateUserId } from "../storage/identity.repository";
import { apiRequest } from "./api-client";

const jsonHeaders = { "content-type": "application/json" };

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
