import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import KimboActivityModule, { type LiveActivityActionEventPayload } from "../../../../modules/live-update";
import { useIslandMealLogging } from "@/features/meals/hooks/useIslandMealLogging";
import { kimboMode } from "@/features/kimbo/kimbo-mode.store";
import { useKimboDay } from "@/features/kimbo/hooks/useKimboDay";
import { resolveLiveActivityProvider } from "@/native/live-update/live-activity";

import { useActiveSession, useTodaySteps } from "../hooks/activity.queries";
import { useEndActivity } from "../hooks/useEndActivity";
import { useStartActivity } from "../hooks/useStartActivity";

/**
 * Root-level bridge between React Native (the source of truth) and the Android system surfaces:
 * the live notification and the Kimbo Mode island. Renders nothing.
 */
export function LiveActivityCoordinator() {
  const day = useKimboDay();
  const session = day?.session ?? null;
  // Keep live step updates flowing app-wide while a walk runs, not only on the Activity screen.
  useTodaySteps(Boolean(session));
  const { endActivity } = useEndActivity();
  const { startActivity } = useStartActivity();
  const presentedSessionId = useRef<string | null>(null);
  const isHandlingAction = useRef(false);

  // Kimbo Mode persists natively, but its island service does not survive a process restart.
  // Re-assert it on launch and whenever the app returns (e.g. after granting display access).
  useEffect(() => {
    const sync = () => {
      kimboMode.refresh();
      const { hasPermission, isEnabled } = kimboMode.get();
      if (isEnabled && hasPermission) kimboMode.setEnabled(true);
    };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => subscription.remove();
  }, []);

  // Mirror the active walk into the live notification / island.
  const steps = day?.steps ?? 0;
  const stepTarget = day?.goal.dailyStepTarget ?? 8_000;
  useEffect(() => {
    if (!session) {
      presentedSessionId.current = null;
      return;
    }
    const isNew = presentedSessionId.current !== session.id;
    presentedSessionId.current = session.id;
    const progress = {
      current: steps,
      target: stepTarget,
      startingSteps: session.startingSteps,
      startedAtMillis: new Date(session.startedAt).getTime(),
    };
    void resolveLiveActivityProvider()
      .then((provider) => (isNew ? provider.start({ type: "walking", ...progress }) : provider.update(progress)))
      .catch(() => undefined);
  }, [session, stepTarget, steps]);

  // Give the island today's picture so it is useful without opening the app.
  const lastSnapshot = useRef("");
  useEffect(() => {
    if (!day || !KimboActivityModule) return;
    const snapshot = {
      mood: day.reaction.mood,
      line: day.reaction.line,
      calories: day.calories,
      calorieTarget: day.goal.dailyCalorieTarget,
      protein: day.protein,
      proteinTarget: day.goal.dailyProteinTargetGrams,
      steps: day.steps,
      stepTarget: day.goal.dailyStepTarget,
    };
    // The day re-evaluates every minute; only cross the bridge when something visible changed.
    const signature = JSON.stringify(snapshot);
    if (signature === lastSnapshot.current) return;
    lastSnapshot.current = signature;
    KimboActivityModule.setIslandSnapshot(snapshot);
  }, [day]);

  // Actions tapped on the island: native records them, React Native performs them.
  const meal = useIslandMealLogging(day);
  const latest = useRef({ endActivity, meal, session, startActivity, steps });
  useEffect(() => {
    latest.current = { endActivity, meal, session, startActivity, steps };
  });
  const handleAction = useCallback(async ({ action, uri }: LiveActivityActionEventPayload) => {
    KimboActivityModule?.consumePendingLiveActivityAction();
    const current = latest.current;
    // Meal steps run independently, so Discard still works while a recording is being analysed.
    if (action === "meal-voice") return uri ? current.meal.handleVoice(uri) : undefined;
    if (action === "meal-save") return current.meal.handleSave();
    if (action === "meal-discard") return current.meal.handleDiscard();
    if (isHandlingAction.current) return;
    isHandlingAction.current = true;
    try {
      if (action === "end" && current.session) await current.endActivity(current.session, current.steps);
      if (action === "start" && !current.session) await current.startActivity();
    } finally {
      isHandlingAction.current = false;
    }
  }, []);

  useEffect(() => {
    const subscription = KimboActivityModule?.addListener("onLiveActivityAction", (payload) => void handleAction(payload));
    return () => subscription?.remove();
  }, [handleAction]);

  // An action tapped while the app was closed waits until today's data (incl. the session) loads.
  const { isSuccess: isSessionLoaded } = useActiveSession();
  const isReady = Boolean(day) && isSessionLoaded;
  useEffect(() => {
    if (!isReady) return;
    const pending = KimboActivityModule?.consumePendingLiveActivityAction();
    if (pending) void handleAction(pending);
  }, [handleAction, isReady]);

  return null;
}
