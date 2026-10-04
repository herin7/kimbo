import { NativeModule, requireOptionalNativeModule } from 'expo';

import { HealthConnectAvailability, IslandMeal, IslandSnapshot, LiveActivityActionEventPayload, KimboActivityModuleEvents, LiveActivityStartInput, LiveActivityUpdateInput } from './KimboActivity.types';

declare class KimboActivityModule extends NativeModule<KimboActivityModuleEvents> {
  getHealthConnectAvailability(): HealthConnectAvailability;
  hasStepPermissions(): Promise<boolean>;
  requestStepPermissions(): Promise<boolean>;
  hasActivityRecognitionPermission(): boolean;
  requestActivityRecognitionPermission(): Promise<void>;
  getTodaySteps(): Promise<number>;
  startStepUpdates(baseTodaySteps: number): Promise<void>;
  stopStepUpdates(): Promise<void>;
  hasNotificationPermission(): boolean;
  requestNotificationPermission(): Promise<void>;
  isLiveUpdateSupported(): boolean;
  hasOverlayPermission(): boolean;
  requestOverlayPermission(): Promise<boolean>;
  isOverlayEnabled(): boolean;
  setOverlayEnabled(isEnabled: boolean): void;
  consumePendingLiveActivityAction(): LiveActivityActionEventPayload | null;
  setIslandMeal(meal: IslandMeal): void;
  setIslandSnapshot(snapshot: IslandSnapshot): void;
  startLiveActivity(input: LiveActivityStartInput): Promise<void>;
  updateLiveActivity(input: LiveActivityUpdateInput): Promise<void>;
  endLiveActivity(): Promise<void>;
}

export default requireOptionalNativeModule<KimboActivityModule>('KimboActivity');
