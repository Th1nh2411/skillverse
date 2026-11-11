import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getProfile } from "../src";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "../src/testing";

const db = getTestDb();

let common: FxSkill, rare: FxSkill, legend: FxSkill, juggling: FxSkill;
let me: { id: string; handle: string }, viewer: { id: string };

beforeAll(async () => {
  await resetDb(db);
  const c1 = await fx.category(db, { slug: "sinh-ton", name: "Sinh tồn" });
  const c2 = await fx.category(db, { slug: "ky-nang-di", name: "Kỹ năng dị" });
  common = await fx.skill(db, { categoryId: c1.id, name: "Sơ cứu", holderCount: 1200 });
  rare = await fx.skill(db, { categoryId: c1.id, name: "Nhóm lửa", holderCount: 214 });
  legend = await fx.skill(db, { categoryId: c2.id, name: "Mở khóa", holderCount: 38 });
  juggling = await fx.skill(db, { categoryId: c2.id, name: "Tung hứng", holderCount: 350 });

  me = await fx.user(db, { handle: "minh_test", totalXp: 350, reputation: 82 });
  viewer = await fx.user(db);
  await fx.setUserSkillLevel(db, me.id, common.id, 5);
  await fx.setUserSkillLevel(db, me.id, rare.id, 4);
  await fx.setUserSkillLevel(db, me.id, legend.id, 2);
  await fx.setUserSkillLevel(db, me.id, juggling.id, 0);
  await fx.proof(db, { userId: me.id, skill: juggling, targetLevel: 1, status: "in_review" });

  // 2 người duyệt khác nhau đạt cho bằng chứng Nhóm lửa (3 phiếu, 1 người duyệt 2 lần), 1 phiếu trượt
  const r1 = await fx.user(db);
  const r2 = await fx.user(db);
  const r3 = await fx.user(db);
  for (const [lvl, reviewers] of [
    [3, [r1, r2, r3]],
    [4, [r1]],
  ] as const) {
    const p = await fx.proof(db, { userId: me.id, skill: rare, targetLevel: lvl, status: "passed" });
    for (const [i, r] of reviewers.entries()) {
      const a = await db.reviewAssignment.create({ data: { proofId: p.id, reviewerId: r.id, dueAt: new Date() } });
      await fx.review(db, { assignmentId: a.id, verdict: i === 2 ? "fail" : "pass" });
    }
  }

  await fx.follow(db, viewer.id, me.id);
  const ch = await db.challenge.create({
    data: { title: "T", skillId: rare.id, criteria: {}, startsAt: new Date(), endsAt: new Date() },
  });
  const cp = await fx.proof(db, { userId: me.id, skill: rare, targetLevel: 2, status: "failed" });
  await db.challengeEntry.create({ data: { challengeId: ch.id, userId: me.id, proofId: cp.id } });
});

afterAll(async () => {
  await closeTestDb();
});

describe("getProfile", () => {
  it("cấp tổng + tiến độ XP từ account_level_curve", async () => {
    const p = await getProfile(db, { handle: "minh_test", viewerId: viewer.id });
    expect(p.xp).toMatchObject({ level: 3, xpIntoLevel: 50, xpForNextLevel: 300 });
    expect(p.reputation).toBe(82);
    expect(p.isMe).toBe(false);
    expect(p.viewerFollows).toBe(true);
    expect(p).not.toHaveProperty("email");
  });

  it("thống kê: số kỹ năng, huy hiệu hiếm, thử thách", async () => {
    const p = await getProfile(db, { userId: me.id, viewerId: me.id });
    expect(p.isMe).toBe(true);
    expect(p.viewerFollows).toBe(false);
    expect(p.stats).toEqual({ skillCount: 4, rareBadgeCount: 2, challengeCount: 1, followerCount: 1, followingCount: 0 });
    expect(p.topCategories.map((c) => c.slug)).toEqual(["sinh-ton", "ky-nang-di"]);
  });

  it("kỹ năng nổi bật: huyền thoại → hiếm → thường, số người xác thực, chờ duyệt", async () => {
    const p = await getProfile(db, { handle: "minh_test" });
    expect(p.featuredSkills.map((f) => [f.name, f.level, f.rarity])).toEqual([
      ["Mở khóa", 2, "legendary"],
      ["Nhóm lửa", 4, "rare"],
      ["Tung hứng", 0, "rare"],
      ["Sơ cứu", 5, null],
    ]);
    const fire = p.featuredSkills.find((f) => f.name === "Nhóm lửa")!;
    expect(fire.verifiedByCount).toBe(2);
    expect(fire.pendingTargetLevel).toBeNull();
    expect(p.featuredSkills.find((f) => f.name === "Tung hứng")!.pendingTargetLevel).toBe(1);
  });

  it("không tìm thấy → NOT_FOUND; thiếu tham số → BAD_REQUEST", async () => {
    await expect(getProfile(db, { handle: "khong_co" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getProfile(db, {})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
