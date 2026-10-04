import type { ActivitySession } from "@kimbo/contracts";
import * as Haptics from "expo-haptics";

import { resolveLiveActivityProvider } from "@/native/live-update/live-activity";
import { syncActivitySession } from "@/shared/api/health-data.api";

import { useSaveActivitySession } from "./activity.queries";

export function useEndActivity() {
  const saveSession = useSaveActivitySession();

  const endActivity = async (session: ActivitySession, todaySteps: number) => {
    if (saveSession.isPending) return;

    // Sensor delivery and local persistence are asynchronous. Never replace a newer stored count
    // with an older query snapshot when the user ends the walk.
    const finalSteps = Math.max(todaySteps, session.currentSteps);

    const ended: ActivitySession = {
      ...session,
      state: "ended",
      endedAt: new Date().toISOString(),
      endingSteps: finalSteps,
      currentSteps: finalSteps,
      estimatedDistanceMeters: Math.max(0, finalSteps - session.startingSteps) * 0.76,
      syncStatus: "pending",
    };

    // Commit the session locally first. Network, notification, and haptic cleanup must never keep
    // the UI stuck in an active walk or risk discarding the final step total.
    await saveSession.mutateAsync(ended);
    void Promise.allSettled([
      syncActivitySession(ended).then((synced) => saveSession.mutateAsync(synced)),
      resolveLiveActivityProvider().then((provider) => provider.end()),
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ]);
  };

  return { endActivity, isEnding: saveSession.isPending };
}
