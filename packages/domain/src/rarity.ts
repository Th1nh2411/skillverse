import type { RarityThresholds } from "./config";

/** Nhãn độ hiếm theo holder_count (DATA_MODEL mục 7). null = không gắn nhãn. */
export type Rarity = "legendary" | "rare" | null;

export function rarityOf(holderCount: number, thresholds: RarityThresholds): Rarity {
  if (holderCount < thresholds.legendary) return "legendary";
  if (holderCount < thresholds.rare) return "rare";
  return null;
}

/** Thứ tự để sắp xếp: huyền thoại trước, rồi hiếm, rồi không nhãn. */
export function rarityRank(r: Rarity): number {
  return r === "legendary" ? 0 : r === "rare" ? 1 : 2;
}
