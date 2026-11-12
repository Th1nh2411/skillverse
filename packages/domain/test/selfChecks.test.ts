/**
 * D73 — tự đánh dấu mốc: thứ tự, bỏ đánh dấu, không XP/uy tín, không đổi level đã xác thực,
 * cây kỹ năng mở khóa theo max(selfLevel, level), hồ sơ + chi tiết hiển thị tiến độ.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignReviewers,
  checkMilestone,
  computeSelfLevel,
  getProfile,
  getSkillDetail,
  getSkillTree,
  listUserSkills,
  submitProof,
  uncheckMilestone,
} from "../src";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "../src/testing";
import { hash, NOW, rng } from "./helpers";

const db = getTestDb();
let cat: { id: string; slug: string };
let base: FxSkill;
let child: FxSkill;

const lvId = (s: FxSkill, l: number) => s.levels.get(l)!.levelId;

async function snapshot(userId: string) {
  const [u, us, xp, rep] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { totalXp: true, reputation: true, accountLevel: true } }),
    db.userSkill.findMany({ where: { userId }, select: { skillId: true, level: true, xp: true }, orderBy: { skillId: "asc" } }),
    db.xpLedger.count({ where: { userId } }),
    db.reputationEvent.count({ where: { userId } }),
  ]);
  return { u, levels: us.map((r) => [r.skillId, r.level, r.xp]), xp, rep };
}

beforeAll(async () => {
  await resetDb(db);
  cat = await fx.category(db, { slug: "tu-danh-dau", name: "Tự đánh dấu" });
  base = await fx.skill(db, { categoryId: cat.id, slug: "nen-tang-s", name: "Nền tảng" });
  child = await fx.skill(db, { categoryId: cat.id, slug: "nang-cao-s", name: "Nâng cao" });
  await fx.edge(db, base.id, child.id, 2);
});

afterAll(async () => {
  await closeTestDb();
});

describe("computeSelfLevel", () => {
  it("chuỗi liên tiếp tính cả mốc đã xác thực; luôn ≥ level", () => {
    expect(computeSelfLevel(0, [], 5)).toBe(0);
    expect(computeSelfLevel(0, [1, 2, 4], 5)).toBe(2);
    expect(computeSelfLevel(3, [], 5)).toBe(3);
    expect(computeSelfLevel(3, [4, 5], 5)).toBe(5);
    expect(computeSelfLevel(1, [3], 5)).toBe(1);
  });
});

describe("checkMilestone / uncheckMilestone", () => {
  it("phải theo thứ tự; tự theo dõi kỹ năng (level 0); không XP, không uy tín, không đổi level", async () => {
    const u = await fx.user(db);
    const before = await snapshot(u.id);
    await expect(checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 2) })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Cấp 1"),
    });
    const r1 = await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 1), now: NOW });
    expect(r1).toEqual({ skillId: base.id, level: 1, checked: true, verifiedLevel: 0, selfLevel: 1 });
    // Tự theo dõi: user_skills ở level 0 + skill_follows
    expect(await db.userSkill.findUnique({ where: { userId_skillId: { userId: u.id, skillId: base.id } } })).toMatchObject({ level: 0, xp: 0 });
    expect(await db.skillFollow.count({ where: { userId: u.id, skillId: base.id } })).toBe(1);
    // Idempotent
    expect(await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 1) })).toMatchObject({ selfLevel: 1 });
    expect(await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 2) })).toMatchObject({ selfLevel: 2 });
    expect(await db.milestoneCheck.count({ where: { userId: u.id } })).toBe(2);

    const after = await snapshot(u.id);
    expect(after.u).toEqual(before.u);
    expect(after.xp).toBe(before.xp);
    expect(after.rep).toBe(before.rep);
    expect(after.levels).toEqual([[base.id, 0, 0]]);
  });

  it("mốc trước đã xác thực thì đánh dấu tiếp được; mốc đã xác thực không cần ghi", async () => {
    const u = await fx.user(db);
    await fx.setUserSkillLevel(db, u.id, base.id, 3);
    expect(await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 2) })).toMatchObject({ verifiedLevel: 3, selfLevel: 3 });
    expect(await db.milestoneCheck.count({ where: { userId: u.id } })).toBe(0);
    await expect(checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 5) })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 4) })).toMatchObject({ selfLevel: 4 });
    expect((await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: u.id, skillId: base.id } } })).level).toBe(3);
  });

  it("chỉ bỏ được mốc cao nhất; không bỏ mốc ≤ level đã xác thực", async () => {
    const u = await fx.user(db);
    await fx.setUserSkillLevel(db, u.id, base.id, 1);
    await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 2) });
    await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 3) });
    await expect(uncheckMilestone(db, { userId: u.id, skillLevelId: lvId(base, 2) })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(uncheckMilestone(db, { userId: u.id, skillLevelId: lvId(base, 1) })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(uncheckMilestone(db, { userId: u.id, skillLevelId: lvId(base, 4) })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await uncheckMilestone(db, { userId: u.id, skillLevelId: lvId(base, 3) })).toEqual({
      skillId: base.id,
      level: 3,
      checked: false,
      verifiedLevel: 1,
      selfLevel: 2,
    });
    expect(await uncheckMilestone(db, { userId: u.id, skillLevelId: lvId(base, 2) })).toMatchObject({ selfLevel: 1 });
    expect((await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: u.id, skillId: base.id } } })).level).toBe(1);
  });

  it("người bị khóa / kỹ năng không hoạt động bị từ chối", async () => {
    const banned = await fx.user(db, { status: "banned" });
    await expect(checkMilestone(db, { userId: banned.id, skillLevelId: lvId(base, 1) })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const archived = await fx.skill(db, { categoryId: cat.id, status: "archived" });
    const u = await fx.user(db);
    await expect(checkMilestone(db, { userId: u.id, skillLevelId: lvId(archived, 1) })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("hiển thị + quy tắc chỉ dựa trên level đã xác thực", () => {
  it("cây kỹ năng mở khóa theo max(selfLevel, level); chi tiết có checked/verified + nextMilestone sau tiến độ", async () => {
    const u = await fx.user(db);
    await fx.setUserSkillLevel(db, u.id, base.id, 1);
    let tree = await getSkillTree(db, { userId: u.id, categorySlug: cat.slug });
    expect(tree.nodes.find((n) => n.skillId === child.id)?.state).toBe("locked");

    await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 2) });
    tree = await getSkillTree(db, { userId: u.id, categorySlug: cat.slug });
    const b = tree.nodes.find((n) => n.skillId === base.id)!;
    expect(b).toMatchObject({
      level: 1,
      selfLevel: 2,
      selfLevelTitle: "Cấp 2",
      nextLevelTitle: "Cấp 3",
      next: { level: 3 },
      nextSkillLevelId: lvId(base, 3),
      verifiedCount: 1,
      verifyLevel: 2,
      verifyLevelTitle: "Cấp 2",
      verifySkillLevelId: lvId(base, 2),
    });
    const c = tree.nodes.find((n) => n.skillId === child.id)!;
    expect(c.state).toBe("practicing");
    expect(c.prerequisites[0]).toMatchObject({ userLevel: 1, userSelfLevel: 2, met: true });

    const d = await getSkillDetail(db, { slug: base.slug, userId: u.id });
    expect(d).toMatchObject({ myLevel: 1, selfLevel: 2, selfLevelTitle: "Cấp 2", nextMilestone: { level: 3 } });
    expect(d.levels.map((l) => [l.level, l.verified, l.checked])).toEqual([
      [1, true, false],
      [2, false, true],
      [3, false, false],
      [4, false, false],
      [5, false, false],
    ]);
    // Chưa đăng nhập
    expect(await getSkillDetail(db, { slug: base.slug })).toMatchObject({ selfLevel: 0, nextMilestone: { level: 1 } });
  });

  it("hồ sơ: selfLevel trên featuredSkills (kể cả chưa xác thực) và profile.skills", async () => {
    const u = await fx.user(db);
    await checkMilestone(db, { userId: u.id, skillLevelId: lvId(child, 1) });
    await fx.setUserSkillLevel(db, u.id, base.id, 2);
    await checkMilestone(db, { userId: u.id, skillLevelId: lvId(base, 3) });
    const p = await getProfile(db, { userId: u.id });
    expect(p.featuredSkills.find((f) => f.skillId === child.id)).toMatchObject({ level: 0, selfLevel: 1, nextLevelTitle: "Cấp 2" });
    expect(p.featuredSkills.find((f) => f.skillId === base.id)).toMatchObject({
      level: 2,
      selfLevel: 3,
      selfLevelTitle: "Cấp 3",
      nextSkillLevelId: lvId(base, 4),
      verifiedCount: 2,
      verifyLevel: 3,
      verifyLevelTitle: "Cấp 3",
      verifySkillLevelId: lvId(base, 3),
    });
    expect(p.featuredSkills.find((f) => f.skillId === child.id)).toMatchObject({
      nextSkillLevelId: lvId(child, 2),
      verifiedCount: 0,
      verifyLevel: 1,
      verifySkillLevelId: lvId(child, 1),
    });
    // Huy hiệu hiếm / danh mục vẫn theo level đã xác thực
    const list = await listUserSkills(db, { userId: u.id });
    expect(list.map((s) => [s.skillId, s.level, s.selfLevel])).toEqual([[base.id, 2, 3]]);
    expect(list[0]).toMatchObject({ nextSkillLevelId: lvId(base, 4), verifiedCount: 2, verifyLevel: 3, verifySkillLevelId: lvId(base, 3) });
  });

  it("đã xác thực mốc cuối → verify* null; tự đánh dấu hết → nextSkillLevelId null", async () => {
    const u = await fx.user(db);
    await fx.setUserSkillLevel(db, u.id, base.id, 5);
    await fx.setUserSkillLevel(db, u.id, child.id, 4);
    await checkMilestone(db, { userId: u.id, skillLevelId: lvId(child, 5) });
    const p = await getProfile(db, { userId: u.id });
    expect(p.featuredSkills.find((f) => f.skillId === base.id)).toMatchObject({
      verifiedCount: 5,
      nextSkillLevelId: null,
      verifyLevel: null,
      verifyLevelTitle: null,
      verifySkillLevelId: null,
    });
    expect(p.featuredSkills.find((f) => f.skillId === child.id)).toMatchObject({
      selfLevel: 5,
      nextSkillLevelId: null,
      verifyLevel: 5,
      verifySkillLevelId: lvId(child, 5),
    });
  });

  it("nộp bằng chứng vẫn theo level đã xác thực + 1; người duyệt chỉ là người đã xác thực", async () => {
    const skill = await fx.skill(db, { categoryId: cat.id });
    const u = await fx.user(db);
    await checkMilestone(db, { userId: u.id, skillLevelId: lvId(skill, 1) });
    await checkMilestone(db, { userId: u.id, skillLevelId: lvId(skill, 2) });
    await expect(
      submitProof(db, { userId: u.id, skillId: skill.id, targetLevel: 3, mediaUrl: "proofs/s.mp4", mediaHash: hash(), now: NOW, rng }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    // Người chỉ tự đánh dấu tới mốc 5 không được phân công duyệt
    const selfOnly = await fx.user(db, { reputation: 99 });
    for (let l = 1; l <= 5; l++) await checkMilestone(db, { userId: selfOnly.id, skillLevelId: lvId(skill, l) });
    const { proofId } = await submitProof(db, {
      userId: u.id,
      skillId: skill.id,
      targetLevel: 1,
      mediaUrl: "proofs/t.mp4",
      mediaHash: hash(),
      now: NOW,
      rng,
    });
    const r = await assignReviewers(db, { proofId, now: NOW, rng });
    expect(r.assignedReviewerIds).not.toContain(selfOnly.id);
    expect(await db.reviewAssignment.count({ where: { proofId, reviewerId: selfOnly.id } })).toBe(0);
  });
});
