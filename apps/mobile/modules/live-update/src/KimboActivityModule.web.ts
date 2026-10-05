import { NativeModule, registerWebModule } from 'expo';

import type { HealthConnectAvailability, IslandMeal, IslandSnapshot, KimboActivityModuleEvents, LiveActivityStartInput, LiveActivityUpdateInput } from './KimboActivity.types';

class KimboActivityModule extends NativeModule<KimboActivityModuleEvents> {
  getHealthConnectAvailability(): HealthConnectAvailability { return 'unavailable'; }
  async hasStepPermissions() { return false; }
  async requestStepPermissions() { return false; }
  async getTodaySteps() { return 0; }
  async startStepUpdates(_baseTodaySteps: number) {}
  async stopStepUpdates() {}
  hasNotificationPermission() { return false; }
  async requestNotificationPermission() {}
  isLiveUpdateSupported() { return false; }
  hasOverlayPermission() { return false; }
  async requestOverlayPermission() { return false; }
  isOverlayEnabled() { return false; }
  setOverlayEnabled(_isEnabled: boolean) {}
  consumePendingLiveActivityAction() { return null; }
  setIslandSnapshot(_snapshot: IslandSnapshot) {}
  setIslandMeal(_meal: IslandMeal) {}
  clearIslandState() {}
  async startLiveActivity(_input: LiveActivityStartInput) {}
  async updateLiveActivity(_input: LiveActivityUpdateInput) {}
  async endLiveActivity() {}
}

export default registerWebModule(KimboActivityModule, 'KimboActivity');
