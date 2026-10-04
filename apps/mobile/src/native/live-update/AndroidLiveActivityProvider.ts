import KimboActivityModule from "../../../modules/live-update";

import type { LiveActivityProvider, LiveActivityStartInput, LiveActivityUpdateInput } from "./LiveActivityProvider";

export class AndroidLiveActivityProvider implements LiveActivityProvider {
  constructor(private readonly preferLiveUpdate: boolean) {}

  async isSupported() {
    return Boolean(KimboActivityModule && (this.preferLiveUpdate ? KimboActivityModule.isLiveUpdateSupported() : true));
  }
  async hasPermission() { return KimboActivityModule?.hasNotificationPermission() ?? false; }
  async requestPermission() { await KimboActivityModule?.requestNotificationPermission(); }
  async preparePresentation() {
    if (this.preferLiveUpdate || !KimboActivityModule || !KimboActivityModule.isOverlayEnabled() || KimboActivityModule.hasOverlayPermission()) return;
    await KimboActivityModule.requestOverlayPermission();
  }
  async start(input: LiveActivityStartInput) { await KimboActivityModule?.startLiveActivity({ ...input, preferLiveUpdate: this.preferLiveUpdate }); }
  async update(input: LiveActivityUpdateInput) { await KimboActivityModule?.updateLiveActivity({ ...input, preferLiveUpdate: this.preferLiveUpdate }); }
  async end() { await KimboActivityModule?.endLiveActivity(); }
}

export class StandardNotificationProvider extends AndroidLiveActivityProvider {
  constructor() { super(false); }
}
