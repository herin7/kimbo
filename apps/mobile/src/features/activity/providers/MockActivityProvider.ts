import type { ActivityProvider } from "./ActivityProvider";

export class MockActivityProvider implements ActivityProvider {
  private steps = 2_750;
  private listeners = new Set<(steps: number) => void>();

  getAvailability() { return "available" as const; }
  async hasPermission() { return true; }
  async requestPermission() { return true; }
  async hasSensorPermission() { return true; }
  async ensureSensorPermission() { return true; }
  async getTodaySteps() { return this.steps; }

  subscribeToSteps(callback: (steps: number) => void) {
    this.listeners.add(callback);
    callback(this.steps);
    return () => this.listeners.delete(callback);
  }

  increment(amount: number) {
    this.steps += amount;
    this.listeners.forEach((listener) => listener(this.steps));
  }
}

export const mockActivityProvider = new MockActivityProvider();
