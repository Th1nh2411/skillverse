import type { Db } from "./db";

/** Đọc ngưỡng từ bảng app_config. KHÔNG hard-code ngưỡng ở nơi khác. */
export async function getConfig<T>(db: Db, key: string): Promise<T> {
  const row = await db.appConfig.findUnique({ where: { key } });
  if (!row) throw new Error(`Thiếu app_config.${key}`);
  return row.value as T;
}

export type RarityThresholds = { legendary: number; rare: number };
export type AccountLevelCurve = { step: number };
export type ReputationDeltas = {
  vote_matched: number;
  vote_mismatched: number;
  approved_fraud: number;
  weekly_recovery: number;
};
export type CriteriaChangeRule = { agree_ratio: number; min_votes: number; voter_min_level: number };
export type MediaLimits = {
  max_mb: number;
  max_seconds: number;
  allowed_types: string[];
  /** Gợi ý cho máy quay trên trình duyệt (D75, migration 0008). Thiếu ở DB cũ → api dùng mặc định. */
  recorder?: { height: number; video_bits_per_second: number };
};

export function getRarityThresholds(db: Db): Promise<RarityThresholds> {
  return getConfig<RarityThresholds>(db, "rarity_thresholds");
}

export function getAccountLevelCurve(db: Db): Promise<AccountLevelCurve> {
  return getConfig<AccountLevelCurve>(db, "account_level_curve");
}
