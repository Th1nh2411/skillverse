import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { onboardingCompleteInput } from "@skillverse/validation";
import { completeOnboarding, getOnboardingOptions } from "../src";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "../src/testing";

const db = getTestDb();
let a: FxSkill, b: FxSkill, c: FxSkill, child: FxSkill, proposed: FxSkill;

beforeAll(async () => {
  await resetDb(db);
  const cat = await fx.category(db, { slug: "sinh-ton", name: "Sinh tồn" });
  a = await fx.skill(db, { categoryId: cat.id, name: "Thắt nút dây", holderCount: 960, criteria: (lv) => [`Bowline cấp ${lv}`] });
  b = await fx.skill(db, { categoryId: cat.id, name: "Sơ cứu", holderCount: 1200 });
  c = await fx.skill(db, { categoryId: cat.id, name: "Huýt sáo bằng lá", holderCount: 41 });
  child = await fx.skill(db, { categoryId: cat.id, name: "Lửa bằng que", holderCount: 214 });
  await fx.edge(db, b.id, child.id, 2);
  proposed = await fx.skill(db, { categoryId: cat.id, name: "Đề xuất", status: "proposed" });
});

afterAll(async () => {
  await closeTestDb();
});

describe("getOnboardingOptions", () => {
  it("danh mục + kỹ năng phổ biến + hiếm, bỏ kỹ năng chưa active", async () => {
    const o = await getOnboardingOptions(db);
    expect(o.minSkills).toBe(3);
    expect(o.categories).toEqual([expect.objectContaining({ slug: "sinh-ton", skillCount: 4 })]);
    expect(o.popularSkills.map((s) => s.name)).toEqual(["Sơ cứu", "Thắt nút dây", "Lửa bằng que", "Huýt sáo bằng lá"]);
    expect(o.rareSkills[0]).toMatchObject({ name: "Huýt sáo bằng lá", rarity: "legendary" });
    expect(o.popularSkills.find((s) => s.id === proposed.id)).toBeUndefined();
  });
});

describe("completeOnboarding", () => {
  it("tạo user_skills level 0, theo dõi kỹ năng, đặt onboarded_at; selfLevels không ghi level", async () => {
    const u = await fx.user(db, { onboarded: false });
    const res = await completeOnboarding(db, {
      userId: u.id,
      skillIds: [child.id, b.id, a.id],
      selfLevels: { [a.id]: "proficient", [b.id]: "some", [child.id]: "proficient" },
    });
    const us = await db.userSkill.findMany({ where: { userId: u.id } });
    expect(us).toHaveLength(3);
    expect(us.every((x) => x.level === 0)).toBe(true);
    expect(await db.skillFollow.count({ where: { userId: u.id } })).toBe(3);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.onboardedAt).not.toBeNull();
    // child bị khóa (cần Sơ cứu cấp 2) → chọn kỹ năng "proficient" còn lại: Thắt nút dây cấp 1
    expect(res.firstChallenge).toMatchObject({
      skillId: a.id,
      targetLevel: 1,
      xpReward: 100,
      criteria: [expect.objectContaining({ text: "Bowline cấp 1" })],
    });
  });

  it("idempotent: gọi lại không trùng, giữ level hiện có và onboarded_at cũ", async () => {
    const u = await fx.user(db);
    const before = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    await fx.setUserSkillLevel(db, u.id, a.id, 2);
    const res = await completeOnboarding(db, { userId: u.id, skillIds: [a.id, b.id, c.id] });
    await completeOnboarding(db, { userId: u.id, skillIds: [a.id, b.id, c.id] });
    const lvA = await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: u.id, skillId: a.id } } });
    expect(lvA.level).toBe(2);
    expect(await db.userSkill.count({ where: { userId: u.id } })).toBe(3);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.onboardedAt?.getTime()).toBe(before.onboardedAt?.getTime());
    // không có selfLevels → theo thứ tự chọn: a ở cấp 2 → thử thách cấp 3
    expect(res.firstChallenge).toMatchObject({ skillId: a.id, targetLevel: 3 });
  });

  it("từ chối < 3 kỹ năng, kỹ năng không active", async () => {
    const u = await fx.user(db, { onboarded: false });
    await expect(completeOnboarding(db, { userId: u.id, skillIds: [a.id, b.id] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      completeOnboarding(db, { userId: u.id, skillIds: [a.id, b.id, proposed.id] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // transaction: không có gì được ghi
    expect(await db.userSkill.count({ where: { userId: u.id } })).toBe(0);
  });

  it("schema Zod: ≥ 3, không trùng, selfLevels hợp lệ", () => {
    const ids = [a.id, b.id, c.id];
    expect(onboardingCompleteInput.parse({ skillIds: ids })).toEqual({ skillIds: ids, selfLevels: {} });
    expect(onboardingCompleteInput.safeParse({ skillIds: [a.id, a.id, b.id] }).success).toBe(false);
    expect(onboardingCompleteInput.safeParse({ skillIds: ids, selfLevels: { [a.id]: "master" } }).success).toBe(false);
  });
});
