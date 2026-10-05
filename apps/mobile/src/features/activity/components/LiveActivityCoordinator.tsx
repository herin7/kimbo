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

  // Android may revoke display access or stop the foreground service outside the app. Re-read the
  // native runtime whenever Kimbo becomes active so the toggle reflects the visible island.
  useEffect(() => {
    kimboMode.refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") kimboMode.refresh();
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
    // Claim the session up front so overlapping renders don't start it twice; release it if the
    // start fails so the next render retries instead of silently leaving the island on "Start walk".
    presentedSessionId.current = session.id;
    const progress = {
      current: steps,
      target: stepTarget,
      startingSteps: session.startingSteps,
      startedAtMillis: new Date(session.startedAt).getTime(),
    };
    void resolveLiveActivityProvider()
      .then((provider) => (isNew ? provider.start({ type: "walking", ...progress }) : provider.update(progress)))
      .catch((error: unknown) => {
        if (isNew && presentedSessionId.current === session.id) presentedSessionId.current = null;
        console.warn("Kimbo: live walk sync failed", error);
      });
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
    const current = latest.current;
    // Consume only after the work succeeds. If local persistence fails or JavaScript is suspended,
    // Android keeps the action durable and it can be retried the next time Kimbo becomes active.
    const complete = async (work: () => Promise<unknown> | unknown) => {
      await work();
      KimboActivityModule?.consumePendingLiveActivityAction();
    };
    // Meal steps run independently, so Discard still works while a recording is being analysed.
    if (action === "meal-voice") return complete(() => uri ? current.meal.handleVoice(uri) : undefined);
    if (action === "meal-save") return complete(() => current.meal.handleSave());
    if (action === "meal-discard") return complete(() => current.meal.handleDiscard());
    if (isHandlingAction.current) return;
    isHandlingAction.current = true;
    try {
      if (action === "end" && current.session) await current.endActivity(current.session, current.steps);
      if (action === "start" && !current.session) await current.startActivity(false);
      KimboActivityModule?.consumePendingLiveActivityAction();
    } finally {
      isHandlingAction.current = false;
    }
  }, []);

  useEffect(() => {
    const subscription = KimboActivityModule?.addListener("onLiveActivityAction", (payload) => {
      void handleAction(payload).catch((error: unknown) => console.warn("Kimbo: island action failed", error));
    });
    return () => subscription?.remove();
  }, [handleAction]);

  // An action tapped while the app was closed waits until today's data (incl. the session) loads.
  const { isSuccess: isSessionLoaded } = useActiveSession();
  const isReady = Boolean(day) && isSessionLoaded;
  useEffect(() => {
    if (!isReady) return;
    const pending = KimboActivityModule?.consumePendingLiveActivityAction();
    if (pending) void handleAction(pending).catch((error: unknown) => console.warn("Kimbo: pending island action failed", error));
  }, [handleAction, isReady]);

  return null;
}
