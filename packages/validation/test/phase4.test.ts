import { describe, expect, it } from "vitest";
import { criteriaEditProposalInput, criteriaVoteInput, listProposalsInput, newSkillProposalInput } from "../src";

const U = "11111111-1111-4111-8111-111111111111";
const lv = (t: string) => [{ text: t }];

describe("schema giai đoạn 4", () => {
  it("kỹ năng mới: tối thiểu 3 cấp, mỗi cấp ≥ 1 tiêu chí, rủi ro mặc định none", () => {
    const ok = newSkillProposalInput.parse({ name: " Huýt sáo ", categorySlug: "ky-nang-di", levels: [lv("Một"), lv("Hai cấp"), lv("Ba cấp")] });
    expect(ok).toMatchObject({ name: "Huýt sáo", riskLevel: "none" });
    expect(ok.levels[0]?.[0]).toEqual({ text: "Một", kind: "checklist" });
    expect(newSkillProposalInput.safeParse({ name: "Ab", categorySlug: "ky-nang-di", levels: [lv("Một"), lv("Hai")] }).success).toBe(false);
    expect(newSkillProposalInput.safeParse({ name: "Ab", categorySlug: "ky-nang-di", levels: [lv("Một"), [], lv("Ba")] }).success).toBe(false);
  });
  it("sửa tiêu chí + phiếu", () => {
    expect(criteriaEditProposalInput.safeParse({ skillLevelId: U, criteria: lv("Gỗ tự kiếm"), summary: "Cấp 4: gỗ" }).success).toBe(true);
    expect(criteriaEditProposalInput.safeParse({ skillLevelId: U, criteria: [], summary: "Cấp 4: gỗ" }).success).toBe(false);
    expect(criteriaVoteInput.safeParse({ proposalId: U, vote: "support" }).success).toBe(false);
    expect(listProposalsInput.parse(undefined)).toEqual({});
  });
});
