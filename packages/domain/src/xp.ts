/**
 * Cấp tài khoản theo app_config.account_level_curve: XP để từ cấp L lên L+1 = step·L
 * (trùng công thức trong packages/db/src/seed.ts). Cấp bắt đầu từ 1.
 */
export function accountLevelForXp(totalXp: number, step: number): number {
  return xpProgress(totalXp, step).level;
}

export type XpProgress = {
  totalXp: number;
  level: number;
  /** XP đã tích trong cấp hiện tại. */
  xpIntoLevel: number;
  /** XP cần để lên cấp kế tiếp (tính từ đầu cấp hiện tại) = step·level. */
  xpForNextLevel: number;
  /** 0..1 */
  ratio: number;
};

export function xpProgress(totalXp: number, step: number): XpProgress {
  if (!(step > 0)) throw new Error("account_level_curve.step phải > 0");
  const total = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let remaining = total;
  while (remaining >= step * level) {
    remaining -= step * level;
    level += 1;
  }
  const xpForNextLevel = step * level;
  return { totalXp: total, level, xpIntoLevel: remaining, xpForNextLevel, ratio: remaining / xpForNextLevel };
}
