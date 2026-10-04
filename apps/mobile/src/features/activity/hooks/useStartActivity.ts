import type { ActivitySession } from "@kimbo/contracts";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";

import { resolveLiveActivityProvider } from "@/native/live-update/live-activity";

import { activityProvider } from "../providers/activity-provider";
import { useSaveActivitySession } from "./activity.queries";

/** Starts a walking session. Shared by the Activity screen and the island's Start action. */
export function useStartActivity() {
  const saveSession = useSaveActivitySession();

  const startActivity = async () => {
    if (saveSession.isPending) return false;
    if (!(await activityProvider.ensureSensorPermission())) return false;
    const notification = await resolveLiveActivityProvider();
    if (!(await notification.hasPermission())) await notification.requestPermission();
    await notification.preparePresentation();
    const current = await activityProvider.getTodaySteps();
    const session: ActivitySession = {
      id: Crypto.randomUUID(),
      type: "walking",
      state: "active",
      startedAt: new Date().toISOString(),
      endedAt: null,
      startingSteps: current,
      currentSteps: current,
      endingSteps: null,
      estimatedDistanceMeters: 0,
      syncStatus: "pending",
    };
    await saveSession.mutateAsync(session);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return true;
  };

  return { startActivity, isStarting: saveSession.isPending };
}
