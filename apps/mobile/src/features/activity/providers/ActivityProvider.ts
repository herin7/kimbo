export type ActivityAvailability = "available" | "updateRequired" | "unavailable";

export interface ActivityProvider {
  getAvailability(): ActivityAvailability;
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  hasSensorPermission(): Promise<boolean>;
  ensureSensorPermission(): Promise<boolean>;
  getTodaySteps(): Promise<number>;
  subscribeToSteps(callback: (steps: number) => void): () => void;
}
