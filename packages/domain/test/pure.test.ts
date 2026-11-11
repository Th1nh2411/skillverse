import { describe, expect, it } from "vitest";
import { accountLevelForXp, normalizeVi, rarityOf, rarityRank, xpProgress } from "../src";

const T = { legendary: 50, rare: 500 };

describe("rarityOf", () => {
  it("dưới 50 → huyền thoại, dưới 500 → hiếm, còn lại không nhãn", () => {
    expect(rarityOf(0, T)).toBe("legendary");
    expect(rarityOf(49, T)).toBe("legendary");
    expect(rarityOf(50, T)).toBe("rare");
    expect(rarityOf(499, T)).toBe("rare");
    expect(rarityOf(500, T)).toBeNull();
    expect(rarityOf(10_000, T)).toBeNull();
  });
  it("rarityRank sắp huyền thoại trước", () => {
    expect(rarityRank("legendary")).toBeLessThan(rarityRank("rare"));
    expect(rarityRank("rare")).toBeLessThan(rarityRank(null));
  });
});

describe("accountLevelForXp / xpProgress (step·L)", () => {
  it("biên cấp với step=100: L1→2 cần 100, L2→3 cần 200", () => {
    expect(accountLevelForXp(0, 100)).toBe(1);
    expect(accountLevelForXp(99, 100)).toBe(1);
    expect(accountLevelForXp(100, 100)).toBe(2);
    expect(accountLevelForXp(299, 100)).toBe(2);
    expect(accountLevelForXp(300, 100)).toBe(3);
  });
  it("khớp công thức seed (tổng XP để đạt cấp L = step·L(L−1)/2)", () => {
    for (const L of [1, 5, 10, 24]) {
      const need = (100 * L * (L - 1)) / 2;
      expect(accountLevelForXp(need, 100)).toBe(L);
      expect(accountLevelForXp(need - 1, 100)).toBe(Math.max(1, L - 1));
    }
  });
  it("xpProgress trả XP trong cấp và XP cần cho cấp kế", () => {
    const p = xpProgress(350, 100);
    expect(p).toEqual({ totalXp: 350, level: 3, xpIntoLevel: 50, xpForNextLevel: 300, ratio: 50 / 300 });
    expect(xpProgress(-5, 100).level).toBe(1);
    expect(() => xpProgress(10, 0)).toThrow();
  });
});

describe("normalizeVi", () => {
  it("bỏ dấu tiếng Việt", () => {
    expect(normalizeVi("Lửa bằng que")).toBe("lua bang que");
    expect(normalizeVi("Đan len")).toBe("dan len");
  });
});
