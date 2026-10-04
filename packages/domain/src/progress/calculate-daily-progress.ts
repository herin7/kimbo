export const clampProgress = (current: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, current / target));
};

export const calculateRemaining = (current: number, target: number): number =>
  Math.max(0, target - current);

export const calculateOverage = (current: number, target: number): number =>
  Math.max(0, current - target);
