import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import KimboActivityModule from "../../../modules/live-update";

export interface KimboModeState {
  /** Native island is supported on this device. */
  isAvailable: boolean;
  /** User wants the island. */
  isEnabled: boolean;
  /** Android "display over other apps" access is granted. */
  hasPermission: boolean;
}

const read = (): KimboModeState => {
  const module = Platform.OS === "android" ? KimboActivityModule : null;
  return {
    isAvailable: Boolean(module),
    isEnabled: module?.isOverlayEnabled() ?? false,
    hasPermission: module?.hasOverlayPermission() ?? false,
  };
};

let state = read();
const listeners = new Set<() => void>();

const publish = (next: KimboModeState) => {
  if (
    next.isAvailable === state.isAvailable &&
    next.isEnabled === state.isEnabled &&
    next.hasPermission === state.hasPermission
  ) return;
  state = next;
  listeners.forEach((listener) => listener());
};

/**
 * Single source of truth for Kimbo Mode. Native owns persistence; this mirrors it so every
 * surface (toggle, permission gate, coordinators) re-renders together.
 */
export const kimboMode = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Re-read native state, e.g. after returning from Android settings. */
  refresh: () => publish(read()),
  setEnabled(isEnabled: boolean) {
    KimboActivityModule?.setOverlayEnabled(isEnabled);
    publish(read());
  },
  async requestPermission() {
    const granted = (await KimboActivityModule?.requestOverlayPermission()) ?? false;
    publish(read());
    return granted;
  },
};

export function useKimboMode(): KimboModeState & { isActive: boolean } {
  const current = useSyncExternalStore(kimboMode.subscribe, kimboMode.get);
  return { ...current, isActive: current.isEnabled && current.hasPermission };
}
