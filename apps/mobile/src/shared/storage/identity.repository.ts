import { AuthSessionSchema, type AuthSession } from "@kimbo/contracts";
import * as Crypto from "expo-crypto";
import Storage from "expo-sqlite/kv-store";

import { parseStoredJson } from "./parse-stored-json";

const SESSION_KEY = "kimbo.auth-session.v1";
const LEGACY_USER_KEY = "kimbo.anonymous-user-id.v1";

export async function getAuthSession(): Promise<AuthSession | null> {
  const stored = await Storage.getItem(SESSION_KEY);
  if (!stored) return null;
  const session = parseStoredJson(stored, AuthSessionSchema);
  if (session) return session;
  await Storage.removeItem(SESSION_KEY);
  return null;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await Storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await Storage.removeItem(SESSION_KEY);
}

export async function getAuthToken(): Promise<string | null> {
  return (await getAuthSession())?.token ?? null;
}

export async function getOrCreateUserId(): Promise<string> {
  const session = await getAuthSession();
  if (session) return session.user.id;
  const existing = await Storage.getItem(LEGACY_USER_KEY);
  if (existing) return existing;
  const userId = Crypto.randomUUID();
  await Storage.setItem(LEGACY_USER_KEY, userId);
  return userId;
}
