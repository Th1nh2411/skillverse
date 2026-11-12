/** Chọn kỹ năng gần xong nhất (theo tiến độ tự đánh dấu) để gợi ý bước tiếp theo. Dùng được ở server. */
export function pickNextSkill<T extends { selfLevel: number; maxLevel: number }>(skills: T[]): T | null {
  const open = skills.filter((s) => s.selfLevel < s.maxLevel);
  open.sort((a, b) => b.selfLevel / b.maxLevel - a.selfLevel / a.maxLevel);
  return open[0] ?? null;
}
