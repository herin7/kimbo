import * as Crypto from "expo-crypto";
import Storage from "expo-sqlite/kv-store";

const KEY = "kimbo.anonymous-user-id.v1";

export async function getOrCreateUserId(): Promise<string> {
  const existing = await Storage.getItem(KEY);
  if (existing) return existing;
  const userId = Crypto.randomUUID();
  await Storage.setItem(KEY, userId);
  return userId;
}
