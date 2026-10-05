import { Platform } from "react-native";

import KimboActivityModule from "../../../../modules/live-update";
import type { ActivityProvider } from "./ActivityProvider";
import { HealthConnectActivityProvider } from "./HealthConnectActivityProvider";
import { mockActivityProvider } from "./MockActivityProvider";

class UnavailableActivityProvider implements ActivityProvider {
  getAvailability() { return "unavailable" as const; }
  async hasPermission() { return false; }
  async requestPermission() { return false; }
  async hasSensorPermission() { return false; }
  async ensureSensorPermission() { return false; }
  async getTodaySteps() { return 0; }
  subscribeToSteps() { return () => undefined; }
}

export const isUsingMockActivityProvider = __DEV__ && (!KimboActivityModule || Platform.OS !== "android");
export const activityProvider: ActivityProvider = Platform.OS === "android" && KimboActivityModule
  ? new HealthConnectActivityProvider()
  : isUsingMockActivityProvider
    ? mockActivityProvider
    : new UnavailableActivityProvider();
