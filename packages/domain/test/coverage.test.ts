/**
 * D5.1/D5.2/D68: người duyệt dự phòng là biên tập viên, kẹp uy tín, thu hồi khi đã lên cấp cao hơn,
 * và cache khớp sổ cái sau các luồng chính.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeCriteriaProposal,
  decideNewSkill,
  finalizeProof,
  getReviewTask,
  progressQuest,
  proposeCriteriaEdit,
  proposeNewSkill,
  recomputeAllUserCaches,
  recomputeUserCaches,
  submitProof,
  submitReview,
  supportProposal,
  voteCriteriaEdit,
  weeklyReputationRecovery,
} from "../src";
import { closeTestDb, fx, getTestDb, resetDb, setConfig, type FxSkill } from "../src/testing";
import { NOW, hash, rng } from "./helpers";

const db = getTestDb();
const DAY = 86_400_000;
let catId: string;
let catSlug: string;

beforeAll(async () => {
  await resetDb(db);
  const c = await fx.category(db);
  catId = c.id;
  catSlug = c.slug;
  await setConfig(db, "editor_fallback_reviewers", true);
  await setConfig(db, "new_skill_support_needed", { supporters: 2, days: 14 });
});

afterAll(async () => {
  await setConfig(db, "new_skill_support_needed", { supporters: 50, days: 14 });
  await closeTestDb();
});

const submit = (skill: FxSkill, userId: string, targetLevel = 1) =>
  submitProof(db, { userId, skillId: skill.id, targetLevel, mediaUrl: `proofs/${randomBytes(4).toString("hex")}.mp4`, mediaHash: hash(), now: NOW, rng });

async function voteAll(proofId: string, verdicts: ("pass" | "fail")[]) {
  const as = await db.reviewAssignment.findMany({ where: { proofId, state: "assigned" }, orderBy: { reviewerId: "asc" } });
  const results = [];
  for (const [i, a] of as.entries()) {
    const v = verdicts[i];
    if (!v) break;
    const t = await getReviewTask(db, { assignmentId: a.id, reviewerId: a.reviewerId, now: NOW });
    results.push(
      await submitReview(db, {
        assignmentId: a.id,
        reviewerId: a.reviewerId,
        verdict: v,
        marks: t.criteria.map((c, j) => ({ criterionId: c.id, met: v === "pass" || j > 0 })),
        now: NOW,
        rng,
      }),
    );
  }
  return results;
}

describe("D68 — biên tập viên dự phòng", () => {
  it("không có ai hợp lệ (kể cả biên tập viên) → giữ pending", async () => {
    const skill = await fx.skill(db, { categoryId: catId });
    const r = await submit(skill, (await fx.user(db)).id);
    expect(r).toMatchObject({ status: "pending", assignedReviewerIds: [] });
  });

  it("kỹ năng mới chưa ai có cấp → 3 biên tập viên hợp lệ (loại người theo dõi, uy tín thấp, bị cấm duyệt), uy tín cao trước", async () => {
    const submitter = await fx.user(db);
    const e = async (reputation: number) => fx.user(db, { isEditor: true, reputation });
    const e1 = await e(90);
    const e2 = await e(85);
    const e3 = await e(80);
    const e4 = await e(75);
    const eFollow = await e(99);
    await fx.follow(db, eFollow.id, submitter.id);
    const eLow = await e(30);
    const eBan = await e(98);
    await db.sanction.create({ data: { userId: eBan.id, kind: "review_ban", reason: "x", startsAt: new Date(NOW.getTime() - DAY) } });
    const eDevice = await e(97);
    await db.deviceFingerprint.createMany({
      data: [
        { userId: submitter.id, fingerprintHash: "fp-d68" },
        { userId: eDevice.id, fingerprintHash: "fp-d68" },
      ],
    });

    const skill = await fx.skill(db, { categoryId: catId });
    const r = await submit(skill, submitter.id);
    expect(r.status).toBe("in_review");
    expect(r.assignedReviewerIds).toEqual([e1.id, e2.id, e3.id]);
    for (const bad of [eFollow, eLow, eBan, eDevice, e4]) expect(r.assignedReviewerIds).not.toContain(bad.id);

    // Người đủ cấp được ưu tiên trước, biên tập viên chỉ bù phần thiếu
    const skill2 = await fx.skill(db, { categoryId: catId });
    const holder = await fx.user(db, { reputation: 45 });
    await fx.setUserSkillLevel(db, holder.id, skill2.id, 5);
    const r2 = await submit(skill2, (await fx.user(db)).id);
    expect(r2.assignedReviewerIds[0]).toBe(holder.id);
    expect(r2.assignedReviewerIds).toHaveLength(3);

    // Biên tập viên chấm đạt → lên cấp 1 như bình thường
    await voteAll(r.proofId, ["pass", "pass", "pass"]);
    expect((await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: submitter.id, skillId: skill.id } } })).level).toBe(1);
  });

  it("tắt editor_fallback_reviewers → không bổ sung biên tập viên", async () => {
    await setConfig(db, "editor_fallback_reviewers", false);
    try {
      const skill = await fx.skill(db, { categoryId: catId });
      expect(await submit(skill, (await fx.user(db)).id)).toMatchObject({ status: "pending", assignedReviewerIds: [] });
    } finally {
      await setConfig(db, "editor_fallback_reviewers", true);
    }
  });
});

describe("uy tín + thu hồi (biên)", () => {
  it("uy tín kẹp [0,100]; sổ cái ghi delta thực áp dụng", async () => {
    await setConfig(db, "editor_fallback_reviewers", false);
    try {
      const skill = await fx.skill(db, { categoryId: catId });
      const top = [await fx.user(db, { reputation: 100 }), await fx.user(db, { reputation: 100 })];
      const low = await fx.user(db, { reputation: 41 });
      for (const u of [...top, low]) await fx.setUserSkillLevel(db, u.id, skill.id, 5);
      const { proofId } = await submit(skill, (await fx.user(db)).id);
      const as = await db.reviewAssignment.findMany({ where: { proofId } });
      for (const a of as) {
        const v = a.reviewerId === low.id ? "fail" : "pass";
        const t = await getReviewTask(db, { assignmentId: a.id, reviewerId: a.reviewerId, now: NOW });
        await submitReview(db, {
          assignmentId: a.id,
          reviewerId: a.reviewerId,
          verdict: v,
          marks: t.criteria.map((c, j) => ({ criterionId: c.id, met: v === "pass" || j > 0 })),
          now: NOW,
        });
      }
      expect((await db.proof.findUniqueOrThrow({ where: { id: proofId } })).status).toBe("passed");
      for (const u of top) {
        expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).reputation).toBe(100);
        expect(await db.reputationEvent.findFirst({ where: { userId: u.id, refId: proofId } })).toMatchObject({ delta: 0, reason: "vote_matched" });
      }
      expect((await db.user.findUniqueOrThrow({ where: { id: low.id } })).reputation).toBe(38);
      // Uy tín 38 < 40 → không được phân công nữa
      const { assignedReviewerIds } = await submit(skill, (await fx.user(db)).id);
      expect(assignedReviewerIds).not.toContain(low.id);
    } finally {
      await setConfig(db, "editor_fallback_reviewers", true);
    }
  });

  it("thu hồi bằng chứng cấp 1 khi đã lên cấp 2 → level = target − 1 = 0 (D40), XP chỉ trừ phần của bằng chứng đó", async () => {
    const editor = await fx.user(db, { isEditor: true, reputation: 50 });
    const skill = await fx.skill(db, { categoryId: catId });
    const reviewers = [];
    for (let i = 0; i < 3; i++) {
      const r = await fx.user(db);
      await fx.setUserSkillLevel(db, r.id, skill.id, 5);
      reviewers.push(r);
    }
    const u = await fx.user(db);
    const p1 = await submit(skill, u.id, 1);
    await voteAll(p1.proofId, ["pass", "pass", "pass"]);
    // Người duyệt đã gặp người nộp trong 30 ngày → vòng 2 cần người khác
    for (let i = 0; i < 3; i++) {
      const r = await fx.user(db);
      await fx.setUserSkillLevel(db, r.id, skill.id, 5);
    }
    const p2 = await submit(skill, u.id, 2);
    await voteAll(p2.proofId, ["pass", "pass", "pass"]);
    expect((await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: u.id, skillId: skill.id } } })).level).toBe(2);

    const res = await finalizeProof(db, { proofId: p1.proofId, revoke: { byUserId: editor.id, reason: "Video cũ" }, now: NOW });
    expect(res).toMatchObject({ outcome: "revoked", previousLevel: 2, newLevel: 0, xpRevoked: 100 });
    const us = await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: u.id, skillId: skill.id } } });
    expect(us).toMatchObject({ level: 0, xp: 200 });
    expect((await recomputeUserCaches(db, { userId: u.id, apply: false })).mismatches).toEqual([]);
  });
});

describe("D5.2 — recomputeUserCaches", () => {
  it("cache khớp sổ cái sau: đạt, duyệt, nhiệm vụ, thu hồi, đề xuất được thông qua, hồi uy tín", async () => {
    await setConfig(db, "editor_fallback_reviewers", false);
    try {
      const editor = await fx.user(db, { isEditor: true });
      const skill = await fx.skill(db, { categoryId: catId });
      const reviewers = [];
      for (let i = 0; i < 3; i++) {
        const r = await fx.user(db);
        await fx.setUserSkillLevel(db, r.id, skill.id, 5);
        reviewers.push(r);
      }
      const u = await fx.user(db);
      const { proofId } = await submit(skill, u.id);
      await voteAll(proofId, ["pass", "pass", "fail"]);
      await progressQuest(db, { userId: u.id, questKey: "practice_10min", now: NOW });
      await finalizeProof(db, { proofId, revoke: { byUserId: editor.id, reason: "x" }, now: NOW });

      // Đề xuất kỹ năng mới được mở + sửa tiêu chí được thông qua (XP tác giả)
      const author = await fx.user(db);
      const np = await proposeNewSkill(db, {
        authorId: author.id,
        name: `Kỹ năng ${randomBytes(3).toString("hex")}`,
        categorySlug: catSlug,
        riskLevel: "none",
        levels: [[{ text: "Một" }], [{ text: "Hai" }], [{ text: "Ba" }]],
        now: NOW,
      });
      await supportProposal(db, { proposalId: np.proposalId, userId: (await fx.user(db)).id, now: NOW });
      await decideNewSkill(db, { proposalId: np.proposalId, editorId: editor.id, decision: "accepted", now: NOW });
      await setConfig(db, "criteria_change_rule", { agree_ratio: 0.7, min_votes: 1, voter_min_level: 5 });
      try {
        const ce = await proposeCriteriaEdit(db, {
          authorId: author.id,
          skillLevelId: skill.levels.get(1)!.levelId,
          summary: "Thêm tiêu chí",
          criteria: [{ text: "Tiêu chí mới" }],
          now: NOW,
        });
        await voteCriteriaEdit(db, { proposalId: ce.proposalId, userId: reviewers[0]!.id, vote: "agree", now: NOW });
        expect((await closeCriteriaProposal(db, { proposalId: ce.proposalId, now: new Date(NOW.getTime() + 15 * DAY) })).status).toBe("accepted");
      } finally {
        await setConfig(db, "criteria_change_rule", { agree_ratio: 0.7, min_votes: 30, voter_min_level: 5 });
      }

      const low = await fx.user(db);
      await db.reputationEvent.create({ data: { userId: low.id, delta: -15, reason: "approved_fraud", createdAt: new Date(NOW.getTime() - 10 * DAY) } });
      await db.user.update({ where: { id: low.id }, data: { reputation: 35 } });
      await weeklyReputationRecovery(db, { now: NOW });

      for (const id of [u.id, author.id, low.id, ...reviewers.map((r) => r.id)]) {
        const r = await recomputeUserCaches(db, { userId: id, apply: false });
        expect({ id, mismatches: r.mismatches }).toEqual({ id, mismatches: [] });
      }
      const authorRow = await db.user.findUniqueOrThrow({ where: { id: author.id } });
      expect(authorRow.totalXp).toBe(300 + 30); // 2 × proposal_accepted + nhiệm vụ suggest_criteria
      expect((await db.user.findUniqueOrThrow({ where: { id: low.id } })).reputation).toBe(36);

      // Làm hỏng cache → tính lại sửa đúng, chạy lại thì khớp
      await db.user.update({ where: { id: u.id }, data: { totalXp: 99999, accountLevel: 40, reputation: 3 } });
      await db.userSkill.update({ where: { userId_skillId: { userId: u.id, skillId: skill.id } }, data: { xp: 777 } });
      const fixed = await recomputeUserCaches(db, { userId: u.id });
      expect(fixed.mismatches.sort()).toEqual(["accountLevel", "reputation", `skillXp:${skill.id}`, "totalXp"].sort());
      expect(fixed.applied).toBe(true);
      expect(await db.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ totalXp: 20, accountLevel: 1, reputation: 50 });
      expect((await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: u.id, skillId: skill.id } } })).xp).toBe(0);
      expect((await recomputeUserCaches(db, { userId: u.id })).mismatches).toEqual([]);

      const all = await recomputeAllUserCaches(db);
      expect(all.mismatched.map((m) => m.userId)).not.toContain(u.id);
      await expect(recomputeUserCaches(db, { userId: "00000000-0000-4000-8000-000000000000" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally {
      await setConfig(db, "editor_fallback_reviewers", true);
    }
  });
});
