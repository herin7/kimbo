import type { ActivitySession } from "@kimbo/contracts";
import * as Haptics from "expo-haptics";

import { resolveLiveActivityProvider } from "@/native/live-update/live-activity";
import { syncActivitySession } from "@/shared/api/health-data.api";

import { useSaveActivitySession } from "./activity.queries";

export function useEndActivity() {
  const saveSession = useSaveActivitySession();

  const endActivity = async (session: ActivitySession, todaySteps: number) => {
    if (saveSession.isPending) return;

    const ended: ActivitySession = {
      ...session,
      state: "ended",
      endedAt: new Date().toISOString(),
      endingSteps: todaySteps,
      currentSteps: todaySteps,
      estimatedDistanceMeters: Math.max(0, todaySteps - session.startingSteps) * 0.76,
    };

    await saveSession.mutateAsync(ended);
    void syncActivitySession(ended)
      .then((synced) => saveSession.mutateAsync(synced))
      .catch(() => undefined);
    await (await resolveLiveActivityProvider()).end();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return { endActivity, isEnding: saveSession.isPending };
}
