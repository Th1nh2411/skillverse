import { describe, expect, it } from "vitest";
import { NEW_SKILL_MAX_LEVELS, newSkillProposalInput, updateMilestoneInput } from "../src";

const U = "11111111-1111-4111-8111-111111111111";
const ms = (title: string, description?: string) => ({ title, description, criteria: [{ text: `Việc ${title}` }] });
const base = { name: "Gấp giấy", categorySlug: "thu-cong" };

describe("mốc kỹ năng (D72)", () => {
  it("đề xuất kỹ năng mới: mỗi mốc có tên (trim, 1–40), hướng dẫn tùy chọn (≤ 300), 3–5 mốc", () => {
    const ok = newSkillProposalInput.parse({ ...base, levels: [ms("  Con hạc "), ms("Ếch nhảy", "  Ấn nhẹ lưng ếch "), ms("Hoa sen")] });
    expect(ok.levels.map((l) => l.title)).toEqual(["Con hạc", "Ếch nhảy", "Hoa sen"]);
    expect(ok.levels[0]?.description).toBeUndefined();
    expect(ok.levels[1]?.description).toBe("Ấn nhẹ lưng ếch");

    expect(NEW_SKILL_MAX_LEVELS).toBe(5);
    const five = Array.from({ length: 5 }, (_, i) => ms(`Mốc ${i + 1}`));
    expect(newSkillProposalInput.safeParse({ ...base, levels: five }).success).toBe(true);
    expect(newSkillProposalInput.safeParse({ ...base, levels: [...five, ms("Mốc 6")] }).success).toBe(false);

    expect(newSkillProposalInput.safeParse({ ...base, levels: [ms("   "), ms("Hai"), ms("Ba")] }).success).toBe(false);
    expect(newSkillProposalInput.safeParse({ ...base, levels: [ms("x".repeat(41)), ms("Hai"), ms("Ba")] }).success).toBe(false);
    expect(newSkillProposalInput.safeParse({ ...base, levels: [ms("Một", "x".repeat(301)), ms("Hai"), ms("Ba")] }).success).toBe(false);
    // Dạng cũ (mảng tiêu chí, không tên mốc) không còn hợp lệ
    expect(newSkillProposalInput.safeParse({ ...base, levels: [[{ text: "Một" }], [{ text: "Hai" }], [{ text: "Ba" }]] }).success).toBe(false);
  });

  it("sửa mốc: cần ít nhất title hoặc description; description null = xóa", () => {
    expect(updateMilestoneInput.parse({ skillLevelId: U, title: " Trời gió " })).toEqual({ skillLevelId: U, title: "Trời gió" });
    expect(updateMilestoneInput.parse({ skillLevelId: U, description: null })).toEqual({ skillLevelId: U, description: null });
    expect(updateMilestoneInput.safeParse({ skillLevelId: U }).success).toBe(false);
    expect(updateMilestoneInput.safeParse({ skillLevelId: U, title: "" }).success).toBe(false);
    expect(updateMilestoneInput.safeParse({ skillLevelId: U, description: "x".repeat(301) }).success).toBe(false);
    expect(updateMilestoneInput.safeParse({ skillLevelId: "khong-phai-uuid", title: "A" }).success).toBe(false);
  });
});
