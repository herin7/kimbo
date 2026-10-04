import { AndroidLiveActivityProvider, StandardNotificationProvider } from "./AndroidLiveActivityProvider";
import type { LiveActivityProvider } from "./LiveActivityProvider";

const promotedProvider = new AndroidLiveActivityProvider(true);
const fallbackProvider = new StandardNotificationProvider();

export async function resolveLiveActivityProvider(): Promise<LiveActivityProvider> {
  return await promotedProvider.isSupported() ? promotedProvider : fallbackProvider;
}
