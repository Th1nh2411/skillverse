import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignReviewers, expireOverdueAssignments, finalizeProof, submitProof } from "../src";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "../src/testing";

const db = getTestDb();
const NOW = new Date("2026-11-11T08:00:00Z");
const rng = () => 0.42;
const hash = () => createHash("sha256").update(randomBytes(16)).digest("hex");

let catId: string;

beforeAll(async () => {
  await resetDb(db);
  catId = (await fx.category(db)).id;
  for (const slug of ["first-proof", "max-level", "rare-holder", "legendary-holder"]) {
    await db.badge.create({ data: { slug, name: slug } });
  }
});

afterAll(async () => {
  await closeTestDb();
});

/** Kỹ năng + người nộp ở `level` + `n` người duyệt hợp lệ (cấp 5, uy tín tăng dần 60, 61, ...). */
async function scenario(o: { level?: number; reviewers?: number; minReviewers?: number; holderCount?: number; risk?: "none" | "high" } = {}) {
  const skill = await fx.skill(db, {
    categoryId: catId,
    minReviewers: o.minReviewers ?? 3,
    holderCount: o.holderCount ?? 1000,
    riskLevel: o.risk ?? "none",
  });
  const submitter = await fx.user(db, { totalXp: 0 });
  if (o.level) await fx.setUserSkillLevel(db, submitter.id, skill.id, o.level);
  const reviewers = [];
  for (let i = 0; i < (o.reviewers ?? 3); i++) {
    const r = await fx.user(db, { reputation: 60 + i });
    await fx.setUserSkillLevel(db, r.id, skill.id, 5);
    reviewers.push(r);
  }
  return { skill, submitter, reviewers };
}

async function submit(skill: FxSkill, userId: string, targetLevel: number, extra: Partial<Parameters<typeof submitProof>[1]> = {}) {
  return submitProof(db, {
    userId,
    skillId: skill.id,
    targetLevel,
    mediaUrl: `proofs/${randomBytes(4).toString("hex")}.mp4`,
    mediaHash: hash(),
    safetyAck: true,
    now: NOW,
    rng,
    ...extra,
  });
}

async function vote(proofId: string, verdicts: ("pass" | "fail")[]) {
  const as = await db.reviewAssignment.findMany({ where: { proofId, state: "assigned" }, orderBy: { assignedAt: "asc" } });
  for (const [i, v] of verdicts.entries()) {
    const a = as[i];
    if (!a) throw new Error("thiếu phân công");
    await fx.review(db, { assignmentId: a.id, verdict: v });
  }
}

const levelOf = async (userId: string, skillId: string) =>
  (await db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId } } }))?.level ?? 0;

describe("submitProof", () => {
  it("hợp lệ → in_review, đủ min_reviewers, lưu criteria_version hiện tại, hạn 48h", async () => {
    const { skill, submitter, reviewers } = await scenario({ level: 1 });
    const r = await submit(skill, submitter.id, 2);
    expect(r.status).toBe("in_review");
    expect(r.duplicate).toBe(false);
    expect(r.assignedReviewerIds.sort()).toEqual(reviewers.map((x) => x.id).sort());
    const proof = await db.proof.findUniqueOrThrow({ where: { id: r.proofId }, include: { reviewAssignments: true } });
    expect(proof.criteriaVersionId).toBe(skill.levels.get(2)!.versionId);
    expect(proof.reviewAssignments[0]!.dueAt.getTime() - NOW.getTime()).toBe(48 * 3_600_000);
    expect(await db.notification.count({ where: { refId: r.proofId, kind: "review_assigned" } })).toBe(3);
  });

  it("chỉ nộp được level == target − 1", async () => {
    const { skill, submitter } = await scenario({ level: 1 });
    await expect(submit(skill, submitter.id, 3)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(submit(skill, submitter.id, 1)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(submit(skill, submitter.id, 6)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("kỹ năng cha phải đạt required_level", async () => {
    const parent = await fx.skill(db, { categoryId: catId });
    const { skill, submitter } = await scenario();
    await fx.edge(db, parent.id, skill.id, 2);
    await fx.setUserSkillLevel(db, submitter.id, parent.id, 1);
    await expect(submit(skill, submitter.id, 1)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await fx.setUserSkillLevel(db, submitter.id, parent.id, 2);
    await expect(submit(skill, submitter.id, 1)).resolves.toMatchObject({ status: "in_review" });
  });

  it("kỹ năng rủi ro cần safetyAck; thời lượng theo media_limits; một bằng chứng mở mỗi kỹ năng", async () => {
    const { skill, submitter } = await scenario({ risk: "high" });
    await expect(submit(skill, submitter.id, 1, { safetyAck: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(submit(skill, submitter.id, 1, { durationS: 181 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await submit(skill, submitter.id, 1, { durationS: 60 });
    await expect(submit(skill, submitter.id, 1)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("trùng hash SHA-256 → fraud_signals duplicate_hash, disputed (hàng đợi biên tập), không phân công", async () => {
    const a = await scenario();
    const b = await scenario();
    const h = hash();
    const first = await submit(a.skill, a.submitter.id, 1, { mediaHash: h });
    expect(first.duplicate).toBe(false);
    const dup = await submit(b.skill, b.submitter.id, 1, { mediaHash: h });
    expect(dup).toMatchObject({ status: "disputed", duplicate: true, assignedReviewerIds: [] });
    const signals = await db.fraudSignal.findMany({ where: { proofId: dup.proofId } });
    expect(signals).toEqual([expect.objectContaining({ signal: "duplicate_hash", userId: b.submitter.id })]);
    expect(await db.reviewAssignment.count({ where: { proofId: dup.proofId } })).toBe(0);
    // Bằng chứng disputed không chốt được qua finalizeProof
    await expect(finalizeProof(db, { proofId: dup.proofId, now: NOW })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("assignReviewers — điều kiện và loại trừ (DATA_MODEL mục 4)", () => {
  it("chỉ chọn người đủ điều kiện, loại người quen/thiết bị trùng/gặp trong 30 ngày", async () => {
    const skill = await fx.skill(db, { categoryId: catId, minReviewerLevel: () => 3 });
    const submitter = await fx.user(db);
    await db.deviceFingerprint.create({ data: { userId: submitter.id, fingerprintHash: "fp-shared" } });
    const mk = async (handle: string, o: { level?: number; reputation?: number; status?: "active" | "banned" } = {}) => {
      const u = await fx.user(db, { handle, reputation: o.reputation ?? 70, status: o.status });
      await fx.setUserSkillLevel(db, u.id, skill.id, o.level ?? 4);
      return u;
    };
    const ok1 = await mk("ok_1");
    const okOldBan = await mk("ok_ban_het_han");
    await db.sanction.create({
      data: { userId: okOldBan.id, kind: "review_ban", reason: "x", startsAt: new Date(NOW.getTime() - 20 * 86_400_000), endsAt: new Date(NOW.getTime() - 86_400_000) },
    });
    const okMetLongAgo = await mk("ok_gap_40_ngay");
    const lowLevel = await mk("thap_cap", { level: 2 });
    const lowRep = await mk("thap_uy_tin", { reputation: 39 });
    const banned = await mk("bi_cam_duyet");
    await db.sanction.create({ data: { userId: banned.id, kind: "review_ban", reason: "x", startsAt: new Date(NOW.getTime() - 86_400_000) } });
    const locked = await mk("tai_khoan_khoa", { status: "banned" });
    const follower = await mk("theo_doi");
    await fx.follow(db, follower.id, submitter.id);
    const followee = await mk("duoc_theo_doi");
    await fx.follow(db, submitter.id, followee.id);
    const swapper = await mk("trao_doi");
    await db.skillSwap.create({
      data: { proposerId: submitter.id, receiverId: swapper.id, teachSkillId: skill.id, learnSkillId: skill.id, mode: "video", status: "cancelled" },
    });
    const sameDevice = await mk("cung_thiet_bi");
    await db.deviceFingerprint.create({ data: { userId: sameDevice.id, fingerprintHash: "fp-shared" } });
    const metRecently = await mk("gap_10_ngay");
    const old1 = await fx.proof(db, { userId: submitter.id, skill, targetLevel: 1, status: "failed" });
    await db.reviewAssignment.create({
      data: { proofId: old1.id, reviewerId: metRecently.id, assignedAt: new Date(NOW.getTime() - 10 * 86_400_000), dueAt: NOW, state: "done" },
    });
    await db.reviewAssignment.create({
      data: { proofId: old1.id, reviewerId: okMetLongAgo.id, assignedAt: new Date(NOW.getTime() - 40 * 86_400_000), dueAt: NOW, state: "done" },
    });

    const proof = await fx.proof(db, { userId: submitter.id, skill, targetLevel: 1 });
    const r = await assignReviewers(db, { proofId: proof.id, count: 20, now: NOW, rng });
    expect(r.assignedReviewerIds.sort()).toEqual([ok1.id, okOldBan.id, okMetLongAgo.id].sort());
    expect(r.shortfall).toBe(17);
    for (const bad of [lowLevel, lowRep, banned, locked, follower, followee, swapper, sameDevice, metRecently, submitter]) {
      expect(r.assignedReviewerIds).not.toContain(bad.id);
    }
    expect((await db.proof.findUniqueOrThrow({ where: { id: proof.id } })).status).toBe("in_review");
    // Gọi lại mặc định: đã đủ 3 → không gán thêm
    expect((await assignReviewers(db, { proofId: proof.id, now: NOW, rng })).assignedReviewerIds).toEqual([]);
  });

  it("cấp cao ưu tiên uy tín cao", async () => {
    const { skill, submitter, reviewers } = await scenario({ level: 4, reviewers: 6 });
    const r = await submit(skill, submitter.id, 5);
    // uy tín 60..65 → chọn 63, 64, 65
    expect(r.assignedReviewerIds.sort()).toEqual(reviewers.slice(3).map((x) => x.id).sort());
  });
});

describe("finalizeProof", () => {
  it("2/3 đạt → passed: level, xp_ledger, total_xp/account_level, bài level_up, thông báo, uy tín", async () => {
    const { skill, submitter, reviewers } = await scenario({ level: 1 });
    const { proofId } = await submit(skill, submitter.id, 2);
    await vote(proofId, ["pass", "pass", "fail"]);
    const r = await finalizeProof(db, { proofId, now: NOW });
    expect(r).toMatchObject({ outcome: "passed", newLevel: 2, xpAwarded: 200, badges: ["first-proof"] });
    expect(await levelOf(submitter.id, skill.id)).toBe(2);
    const us = await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: submitter.id, skillId: skill.id } } });
    expect(us.lastProofId).toBe(proofId);
    expect(r).toMatchObject({ accountLevelBefore: 1, accountLevel: 2 });
    const ledger = await db.xpLedger.findMany({ where: { userId: submitter.id } });
    expect(ledger).toEqual([expect.objectContaining({ amount: 200, reason: "proof_passed", refId: proofId })]);
    const u = await db.user.findUniqueOrThrow({ where: { id: submitter.id } });
    expect(u.totalXp).toBe(200);
    expect(u.accountLevel).toBe(2);
    expect(await db.post.count({ where: { proofId, kind: "level_up" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: submitter.id, kind: "proof_passed" } })).toBe(1);

    // Uy tín: 2 người khớp +1, 1 người lệch −3 (thứ tự phân công theo assignedAt giống nhau → kiểm theo phiếu)
    const reviews = await db.review.findMany({ where: { proofId } });
    for (const rv of reviews) {
      const user = await db.user.findUniqueOrThrow({ where: { id: rv.reviewerId } });
      const before = 60 + reviewers.findIndex((x) => x.id === rv.reviewerId);
      expect(user.reputation).toBe(before + (rv.verdict === "pass" ? 1 : -3));
      const ev = await db.reputationEvent.findMany({ where: { userId: rv.reviewerId, refId: proofId } });
      expect(ev).toEqual([expect.objectContaining({ delta: rv.verdict === "pass" ? 1 : -3, reason: rv.verdict === "pass" ? "vote_matched" : "vote_mismatched" })]);
    }
    // Idempotent: gọi lại không ghi thêm
    expect(await finalizeProof(db, { proofId, now: NOW })).toEqual({ outcome: "already_decided", proofId, status: "passed" });
    expect(await db.xpLedger.count({ where: { userId: submitter.id } })).toBe(1);
    expect((await db.post.findFirstOrThrow({ where: { proofId, kind: "level_up" } })).body).not.toContain("\u00b7");
  });

  it("1/3 đạt → failed, level giữ nguyên, không XP", async () => {
    const { skill, submitter } = await scenario({ level: 1 });
    const { proofId } = await submit(skill, submitter.id, 2);
    await vote(proofId, ["pass", "fail", "fail"]);
    expect(await finalizeProof(db, { proofId, now: NOW })).toMatchObject({ outcome: "failed" });
    expect(await levelOf(submitter.id, skill.id)).toBe(1);
    expect(await db.xpLedger.count({ where: { userId: submitter.id } })).toBe(0);
    expect((await db.proof.findUniqueOrThrow({ where: { id: proofId } })).status).toBe("failed");
  });

  it("chưa đủ phiếu, còn người đang duyệt → waiting", async () => {
    const { skill, submitter } = await scenario();
    const { proofId } = await submit(skill, submitter.id, 1);
    await vote(proofId, ["pass", "pass"]);
    expect(await finalizeProof(db, { proofId, now: NOW })).toMatchObject({ outcome: "waiting", votes: 2, required: 3 });
    expect(await levelOf(submitter.id, skill.id)).toBe(0);
  });

  it("hòa phiếu → thêm một người duyệt uy tín cao, rồi chốt theo phiếu phá hòa", async () => {
    const { skill, submitter, reviewers } = await scenario({ minReviewers: 2, reviewers: 2 });
    const extraLow = await fx.user(db, { reputation: 45 });
    await fx.setUserSkillLevel(db, extraLow.id, skill.id, 5);
    const extraHigh = await fx.user(db, { reputation: 99 });
    await fx.setUserSkillLevel(db, extraHigh.id, skill.id, 5);

    const proof = await fx.proof(db, { userId: submitter.id, skill, targetLevel: 1 });
    await db.proof.update({ where: { id: proof.id }, data: { status: "in_review" } });
    for (const r of reviewers) {
      await db.reviewAssignment.create({ data: { proofId: proof.id, reviewerId: r.id, assignedAt: NOW, dueAt: NOW } });
    }
    await vote(proof.id, ["pass", "fail"]);
    const tie = await finalizeProof(db, { proofId: proof.id, now: NOW, rng });
    expect(tie).toMatchObject({ outcome: "tie", assignedReviewerIds: [extraHigh.id] });
    expect(await finalizeProof(db, { proofId: proof.id, now: NOW })).toMatchObject({ outcome: "waiting" });
    await vote(proof.id, ["pass"]);
    expect(await finalizeProof(db, { proofId: proof.id, now: NOW })).toMatchObject({ outcome: "passed", newLevel: 1 });
    expect(await levelOf(submitter.id, skill.id)).toBe(1);
  });

  it("quá hạn → expired, gán người khác; thiếu người khi chốt → needs_more_reviewers", async () => {
    const { skill, submitter } = await scenario({ reviewers: 4 });
    const { proofId, assignedReviewerIds } = await submit(skill, submitter.id, 1);
    expect(assignedReviewerIds).toHaveLength(3);
    await vote(proofId, ["pass", "pass"]);
    // Cô lập: phân công của các test khác không quá hạn trong test này.
    await db.reviewAssignment.updateMany({
      where: { proofId: { not: proofId }, state: "assigned" },
      data: { dueAt: new Date("2100-01-01T00:00:00Z") },
    });

    const later = new Date(NOW.getTime() + 49 * 3_600_000);
    const res = await expireOverdueAssignments(db, { now: later, rng });
    expect(res).toEqual({ expired: 1, reassigned: 1 });
    const as = await db.reviewAssignment.findMany({ where: { proofId } });
    expect(as.map((a) => a.state).sort()).toEqual(["assigned", "done", "done", "expired"]);
    const fresh = as.find((a) => a.state === "assigned")!;
    expect(fresh.dueAt.getTime()).toBe(later.getTime() + 48 * 3_600_000);

    // Người mới cũng quá hạn; không còn ứng viên → finalize báo thiếu người
    const later2 = new Date(later.getTime() + 49 * 3_600_000);
    expect(await expireOverdueAssignments(db, { now: later2, rng })).toEqual({ expired: 1, reassigned: 0 });
    const r = await finalizeProof(db, { proofId, now: later2 });
    expect(r).toMatchObject({ outcome: "needs_more_reviewers", assignedReviewerIds: [], shortfall: 1 });

    // Có người mới đủ điều kiện → finalize gán bù (uy tín cao)
    const newcomer = await fx.user(db, { reputation: 90 });
    await fx.setUserSkillLevel(db, newcomer.id, skill.id, 5);
    expect(await finalizeProof(db, { proofId, now: later2 })).toMatchObject({
      outcome: "needs_more_reviewers",
      assignedReviewerIds: [newcomer.id],
    });
    await vote(proofId, ["fail"]);
    expect(await finalizeProof(db, { proofId, now: later2 })).toMatchObject({ outcome: "passed" });
  });

  it("đạt cấp cao nhất → holder_count +1, huy hiệu max-level + legendary-holder", async () => {
    const { skill, submitter } = await scenario({ level: 4, holderCount: 10 });
    const { proofId } = await submit(skill, submitter.id, 5);
    await vote(proofId, ["pass", "pass", "pass"]);
    const r = await finalizeProof(db, { proofId, now: NOW });
    expect(r).toMatchObject({ outcome: "passed", newLevel: 5 });
    if (r.outcome === "passed") expect(r.badges.sort()).toEqual(["first-proof", "legendary-holder", "max-level"]);
    expect((await db.skill.findUniqueOrThrow({ where: { id: skill.id } })).holderCount).toBe(11);
  });

  it("chốt đồng thời hai lần chỉ ghi một lần (khóa hàng proofs)", async () => {
    const { skill, submitter } = await scenario({ level: 2 });
    const { proofId } = await submit(skill, submitter.id, 3);
    await vote(proofId, ["pass", "pass", "pass"]);
    const results = await Promise.allSettled([
      finalizeProof(db, { proofId, now: NOW }),
      finalizeProof(db, { proofId, now: NOW }),
    ]);
    const outcomes = results.map((x) => (x.status === "fulfilled" ? x.value.outcome : "error")).sort();
    expect(outcomes).toEqual(["already_decided", "passed"]);
    expect(await db.xpLedger.count({ where: { refId: proofId } })).toBe(1);
    expect(await levelOf(submitter.id, skill.id)).toBe(3);
  });
});

describe("submitProof — media_limits + ai_precheck giả lập", () => {
  it("chặn định dạng/dung lượng ngoài media_limits; lưu ai_precheck chỉ tham khảo", async () => {
    const { skill, submitter } = await scenario();
    await expect(submit(skill, submitter.id, 1, { contentType: "image/gif" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(submit(skill, submitter.id, 1, { sizeBytes: 61 * 1024 * 1024 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const r = await submit(skill, submitter.id, 1, { contentType: "video/mp4", sizeBytes: 10 * 1024 * 1024, durationS: 64 });
    const proof = await db.proof.findUniqueOrThrow({ where: { id: r.proofId } });
    expect(proof.aiPrecheck).toEqual({
      advisoryOnly: true,
      checks: [
        { key: "duration", ok: true, detail: "64/180 giây" },
        { key: "format", ok: true, detail: "video/mp4" },
        { key: "size", ok: true, detail: "10.0/60 MB" },
      ],
    });
  });
});
