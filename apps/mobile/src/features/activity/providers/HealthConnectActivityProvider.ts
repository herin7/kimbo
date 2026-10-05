import KimboActivityModule from "../../../../modules/live-update";

import type { ActivityProvider } from "./ActivityProvider";

export class HealthConnectActivityProvider implements ActivityProvider {
  private callbacks = new Set<(steps: number) => void>();
  private nativeSubscription: { remove(): void } | null = null;
  getAvailability() {
    return KimboActivityModule?.getHealthConnectAvailability() ?? "unavailable";
  }

  async hasPermission() {
    return await KimboActivityModule?.hasStepPermissions() ?? false;
  }

  async requestPermission() {
    return await KimboActivityModule?.requestStepPermissions() ?? false;
  }

  async hasSensorPermission() {
    return KimboActivityModule?.hasActivityRecognitionPermission() ?? false;
  }

  async ensureSensorPermission() {
    const module = KimboActivityModule;
    if (!module) return false;
    if (!(await this.hasSensorPermission())) {
      await module.requestActivityRecognitionPermission();
    }
    return module.hasActivityRecognitionPermission();
  }

  async getTodaySteps() {
    return await KimboActivityModule?.getTodaySteps() ?? 0;
  }

  subscribeToSteps(callback: (steps: number) => void) {
    const module = KimboActivityModule;
    if (!module) return () => undefined;
    this.callbacks.add(callback);
    if (!this.nativeSubscription) {
      this.nativeSubscription = module.addListener("onStepUpdate", ({ steps }) => {
        this.callbacks.forEach((listener) => listener(steps));
      });
      void this.getTodaySteps().then((steps) => {
        this.callbacks.forEach((listener) => listener(steps));
        return module.startStepUpdates(steps);
      });
    }
    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) {
        this.nativeSubscription?.remove();
        this.nativeSubscription = null;
        void module.stopStepUpdates();
      }
    };
  }
}
