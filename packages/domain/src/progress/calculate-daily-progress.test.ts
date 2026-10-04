import { describe, expect, it } from "vitest";

import {
  calculateOverage,
  calculateRemaining,
  clampProgress,
} from "./calculate-daily-progress.js";

describe("daily progress calculations", () => {
  it("clamps progress between zero and one", () => {
    expect(clampProgress(1_000, 2_000)).toBe(0.5);
    expect(clampProgress(2_500, 2_000)).toBe(1);
    expect(clampProgress(-100, 2_000)).toBe(0);
    expect(clampProgress(100, 0)).toBe(0);
  });

  it("separates remaining amount from overage", () => {
    expect(calculateRemaining(1_300, 2_100)).toBe(800);
    expect(calculateRemaining(2_300, 2_100)).toBe(0);
    expect(calculateOverage(2_300, 2_100)).toBe(200);
    expect(calculateOverage(1_300, 2_100)).toBe(0);
  });
});
