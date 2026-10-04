import type { ActivitySession } from "@kimbo/contracts";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";

import { activityProvider } from "../providers/activity-provider";
import { useActiveSession, useSaveActivitySession, useTodaySteps } from "./activity.queries";
import { useEndActivity } from "./useEndActivity";
import { useStartActivity } from "./useStartActivity";

export function useActivityController(stepTarget: number) {
  const { data: session, isLoading: isSessionLoading } = useActiveSession();
  const { data: todaySteps = 0, isLoading: isStepsLoading } = useTodaySteps(Boolean(session));
  const saveSession = useSaveActivitySession();
  const { endActivity, isEnding } = useEndActivity();
  const { startActivity, isStarting } = useStartActivity();
  const lastSteps = useRef(todaySteps);

  useEffect(() => {
    if (!session || session.currentSteps === todaySteps) return;
    const updated: ActivitySession = { ...session, currentSteps: todaySteps, estimatedDistanceMeters: Math.max(0, todaySteps - session.startingSteps) * 0.76 };
    saveSession.mutate(updated);
    const crossedMilestone = lastSteps.current < 5_000 && todaySteps >= 5_000;
    const crossedGoal = lastSteps.current < stepTarget && todaySteps >= stepTarget;
    if (crossedGoal) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (crossedMilestone) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lastSteps.current = todaySteps;
  }, [saveSession, session, stepTarget, todaySteps]);

  const end = async () => {
    if (!session) return;
    await endActivity(session, todaySteps);
  };

  return { session, todaySteps, isLoading: isSessionLoading || isStepsLoading, isSaving: saveSession.isPending || isEnding || isStarting, availability: activityProvider.getAvailability(), hasPermission: () => activityProvider.hasPermission(), requestPermission: () => activityProvider.requestPermission(), start: startActivity, end };
}
