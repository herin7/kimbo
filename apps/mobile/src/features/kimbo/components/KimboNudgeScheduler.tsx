import { planKimboNudges } from "@kimbo/domain";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo } from "react";
import { Platform } from "react-native";

import { useKimboDay } from "../hooks/useKimboDay";

const CHANNEL_ID = "kimbo-check-ins";
const ID_PREFIX = "kimbo-nudge-";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureReady() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Kimbo check-ins",
      description: "A few friendly nudges from Kimbo about protein, meals and movement",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Keeps today's Kimbo check-ins in sync with what the app knows. Whenever the plan changes
 * (a meal is logged, a goal is met), stale nudges are cancelled and the open gaps rescheduled.
 */
export function KimboNudgeScheduler() {
  const day = useKimboDay();
  const nudges = useMemo(() => (day ? planKimboNudges(day.input) : null), [day]);
  // Only reschedule when the plan itself changes, not on every minute tick.
  const signature = nudges?.map((nudge) => `${nudge.id}@${nudge.at.getTime()}:${nudge.body}`).join("|") ?? null;

  useEffect(() => {
    if (!nudges) return;
    let isCancelled = false;
    void (async () => {
      if (!(await ensureReady()) || isCancelled) return;
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((request) => request.identifier.startsWith(ID_PREFIX))
          .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
      );
      if (isCancelled) return;
      await Promise.all(
        nudges.map((nudge) =>
          Notifications.scheduleNotificationAsync({
            identifier: `${ID_PREFIX}${nudge.id}`,
            content: { title: nudge.title, body: nudge.body },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nudge.at, channelId: CHANNEL_ID },
          }),
        ),
      );
    })().catch(() => undefined);
    return () => {
      isCancelled = true;
    };
    // `signature` captures every field of `nudges` that matters for scheduling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return null;
}
