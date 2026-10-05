import * as Notifications from "expo-notifications";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { useAuthSession } from "@/features/auth/hooks/useAuth";
import { useMeals } from "@/features/meals/hooks/meal.queries";
import { useOnboardingStatus } from "@/features/onboarding";
import { useProgressHistory } from "@/features/progress/hooks/useProgressHistory";
import { localClock } from "@kimbo/domain";
import { registerPushToken, syncDailySummary } from "@/shared/api/health-data.api";

import { getGrantedExpoPushToken } from "./notifications.service";

const SYNC_INTERVAL_MS = 10 * 60_000;
const ALLOWED_ROUTES = new Set(["/meal/capture", "/activity", "/progress"]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

async function configureNotifications() {
  if (Platform.OS === "android") {
    await Promise.all([
      Notifications.setNotificationChannelAsync("kimbo-coaching", { name: "Kimbo's nudges", description: "Timely meal and movement suggestions", importance: Notifications.AndroidImportance.HIGH, lightColor: "#FF7657", vibrationPattern: [0, 140, 80, 140] }),
      Notifications.setNotificationChannelAsync("kimbo-wins", { name: "Wins & comebacks", description: "Goal and comeback celebrations", importance: Notifications.AndroidImportance.DEFAULT }),
      Notifications.setNotificationChannelAsync("kimbo-weekly", { name: "Weekly reflection", description: "Your weekly Kimbo reflection", importance: Notifications.AndroidImportance.DEFAULT }),
    ]);
  }
  await Promise.all([
    Notifications.setNotificationCategoryAsync("protein", [{ identifier: "log-meal", buttonTitle: "🍽️ Log a meal", options: { opensAppToForeground: true } }]),
    Notifications.setNotificationCategoryAsync("steps", [{ identifier: "start-walk", buttonTitle: "🚶 Start a walk", options: { opensAppToForeground: true } }]),
    Notifications.setNotificationCategoryAsync("calories", [{ identifier: "plan-dinner", buttonTitle: "🥗 Plan dinner", options: { opensAppToForeground: true } }]),
    Notifications.setNotificationCategoryAsync("wins", [{ identifier: "nice", buttonTitle: "💛 Nice", options: { opensAppToForeground: true } }]),
    Notifications.setNotificationCategoryAsync("weekly", [{ identifier: "see-week", buttonTitle: "📈 See my week", options: { opensAppToForeground: true } }]),
  ]);
}

const routeFrom = (value: unknown) => {
  if (typeof value !== "string") return null;
  const route = value.startsWith("kimbo://") ? `/${value.slice("kimbo://".length).replace(/^\//, "")}` : value;
  return ALLOWED_ROUTES.has(route) ? route as Href : null;
};

export function KimboNotifications() {
  const router = useRouter();
  const { data: auth } = useAuthSession();
  const mealsQuery = useMeals();
  const meals = mealsQuery.data ?? [];
  const { data: goal } = useOnboardingStatus();
  const { data: history } = useProgressHistory();
  const initialMealCount = useRef<number | null>(null);
  const handledResponse = useRef<string | null>(null);
  const lastSummarySync = useRef(0);
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => { void configureNotifications(); }, []);

  useEffect(() => {
    if (!auth) return;
    void getGrantedExpoPushToken().then((token) => token ? registerPushToken(token) : undefined).catch(() => undefined);
  }, [auth]);

  useEffect(() => {
    if (mealsQuery.isLoading) return;
    if (initialMealCount.current === null) {
      initialMealCount.current = meals.length;
      return;
    }
    const previous = initialMealCount.current;
    initialMealCount.current = meals.length;
    if (previous !== 0 || meals.length === 0) return;
    void (async () => {
      const current = await Notifications.getPermissionsAsync();
      if (current.status !== "undetermined") return;
      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted) return;
      const token = await getGrantedExpoPushToken();
      if (token) await registerPushToken(token);
    })().catch(() => undefined);
  }, [meals.length, mealsQuery.isLoading]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || handledResponse.current === response.notification.request.identifier) return;
      handledResponse.current = response.notification.request.identifier;
      const route = routeFrom(response.notification.request.content.data?.url);
      if (route) router.push(route);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegroundTick((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  const today = goal ? localClock(new Date(), goal.timeZone).date : null;
  const summary = useMemo(() => today ? history?.find((entry) => entry.date === today) ?? null : null, [history, today]);
  const summarySignature = summary ? `${summary.date}:${summary.calories}:${summary.proteinGrams}:${summary.steps}:${summary.hasMealData}:${summary.hasActivityData}` : null;
  useEffect(() => {
    if (!auth || !summary || !summarySignature) return;
    const sync = () => {
      lastSummarySync.current = Date.now();
      void syncDailySummary(summary.date, {
        calories: summary.calories,
        proteinGrams: summary.proteinGrams,
        steps: summary.steps,
        hasMealData: summary.hasMealData,
        hasActivityData: summary.hasActivityData,
      }).catch(() => undefined);
    };
    const remaining = SYNC_INTERVAL_MS - (Date.now() - lastSummarySync.current);
    if (remaining <= 0) {
      sync();
      return;
    }
    const timer = setTimeout(sync, remaining);
    return () => clearTimeout(timer);
  }, [auth, foregroundTick, summary, summarySignature]);

  return null;
}
