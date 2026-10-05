import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

export async function getGrantedExpoPushToken() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return null;
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function clearKimboNotifications() {
  await Promise.all([
    Notifications.cancelAllScheduledNotificationsAsync(),
    Notifications.dismissAllNotificationsAsync(),
  ]);
}
