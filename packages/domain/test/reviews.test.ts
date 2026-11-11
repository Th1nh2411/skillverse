import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDomainJobHandlers,
  fileAppeal,
  getLevelUpSummary,
  getProofStatus,
  getReviewQueue,
  getReviewTask,
  getShareCard,
  reportProofDuringReview,
  resolveAppeal,
  submitProof,
  submitReview,
  weeklyReputationRecovery,
} from "../src";
import { InlineJobRunner } from "../src/jobs";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "../src/testing";

const db = getTestDb();
const NOW = new Date("2026-11-11T08:00:00Z");
const rng = () => 0.42;
const hash = () => createHash("sha256").update(randomBytes(16)).digest("hex");

let catId: string;
let editor: { id: string };

beforeAll(async () => {
  await resetDb(db);
  catId = (await fx.category(db)).id;
  editor = await fx.user(db, { isEditor: true, reputation: 95 });
  await db.badge.create({ data: { slug: "first-proof", name: "Bằng chứng đầu tiên" } });
});

afterAll(async () => {
  await closeTestDb();
});

type U = { id: string; handle: string; displayName: string };

/** Kỹ năng, người nộp ở cấp 1 → nộp cấp 2; `n` người duyệt hợp lệ. */
async function setup(o: { reviewers?: number; extraReviewers?: number } = {}) {
  const skill = await fx.skill(db, { categoryId: catId });
  const submitter: U = await fx.user(db, { displayName: "Nguyễn Bí Mật" });
  await fx.setUserSkillLevel(db, submitter.id, skill.id, 1);
  const reviewers: U[] = [];
  for (let i = 0; i < (o.reviewers ?? 3); i++) {
    const r = await fx.user(db, { reputation: 60 + i });
    await fx.setUserSkillLevel(db, r.id, skill.id, 5);
    reviewers.push(r);
  }
  const sub = await submitProof(db, {
    userId: submitter.id,
    skillId: skill.id,
    targetLevel: 2,
    mediaUrl: `proofs/${randomBytes(4).toString("hex")}.mp4`,
    mediaHash: hash(),
    now: NOW,
    rng,
  });
  const extras: U[] = [];
  for (let i = 0; i < (o.extraReviewers ?? 0); i++) {
    const r = await fx.user(db, { reputation: 80 + i });
    await fx.setUserSkillLevel(db, r.id, skill.id, 5);
    extras.push(r);
  }
  const assignments = await db.reviewAssignment.findMany({ where: { proofId: sub.proofId } });
  const byReviewer = new Map(assignments.map((a) => [a.reviewerId, a.id]));
  return { skill, submitter, reviewers, extras, proofId: sub.proofId, byReviewer };
}

async function marksFor(assignmentId: string, reviewerId: string, met: boolean | boolean[]) {
  const t = await getReviewTask(db, { assignmentId, reviewerId, now: NOW });
  return t.criteria.map((c, i) => ({ criterionId: c.id, met: Array.isArray(met) ? met[i]! : met }));
}

async function review(assignmentId: string, reviewerId: string, verdict: "pass" | "fail", comment?: string) {
  const marks = await marksFor(assignmentId, reviewerId, verdict === "pass" ? true : [false, true]);
  return submitReview(db, { assignmentId, reviewerId, verdict, marks, comment, now: NOW, rng });
}

const levelOf = async (userId: string, skillId: string) =>
  (await db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId } } }))?.level ?? 0;

describe("submitReview", () => {
  it("3 phiếu đạt → XP review_done mỗi phiếu, phiếu cuối chốt đạt", async () => {
    const { skill, submitter, reviewers, proofId, byReviewer } = await setup();
    const [r1, r2, r3] = reviewers as [U, U, U];
    const a = await review(byReviewer.get(r1.id)!, r1.id, "pass");
    expect(a.xpAwarded).toBe(25);
    expect(a.quest).toMatchObject({ progress: 1, target: 2, completed: false });
    expect(a.finalize).toMatchObject({ outcome: "waiting", votes: 1, required: 3 });
    await review(byReviewer.get(r2.id)!, r2.id, "pass");
    const c = await review(byReviewer.get(r3.id)!, r3.id, "pass");
    expect(c.finalize).toMatchObject({ outcome: "passed", newLevel: 2 });
    expect(await levelOf(submitter.id, skill.id)).toBe(2);
    const ledger = await db.xpLedger.findMany({ where: { userId: r1.id } });
    expect(ledger).toEqual([expect.objectContaining({ amount: 25, reason: "review_done", refType: "review" })]);
    expect((await db.user.findUniqueOrThrow({ where: { id: r1.id } })).totalXp).toBe(25);
    expect(await db.reviewMark.count({ where: { review: { proofId } } })).toBe(6);
  });

  it("nhiệm vụ ngày review_2: phiếu thứ 2 trong ngày → hoàn thành + XP quest_done", async () => {
    const reviewer = await fx.user(db, { reputation: 70 });
    const s1 = await setup({ reviewers: 0 });
    const s2 = await setup({ reviewers: 0 });
    const results = [];
    for (const s of [s1, s2]) {
      await fx.setUserSkillLevel(db, reviewer.id, s.skill.id, 5);
      const a = await db.reviewAssignment.create({
        data: { proofId: s.proofId, reviewerId: reviewer.id, assignedAt: NOW, dueAt: new Date(NOW.getTime() + 3_600_000) },
      });
      await db.proof.update({ where: { id: s.proofId }, data: { status: "in_review" } });
      results.push(await review(a.id, reviewer.id, "pass"));
    }
    expect(results[1]!.quest).toEqual({ progress: 2, target: 2, completed: true, xpAwarded: 50 });
    const u = await db.user.findUniqueOrThrow({ where: { id: reviewer.id } });
    expect(u.totalXp).toBe(25 + 25 + 50);
    const q = await db.dailyQuest.findFirstOrThrow({ where: { userId: reviewer.id, questKey: "review_2" } });
    expect(q.doneAt).not.toBeNull();
  });

  it("chặn: không được phân công, thiếu tiêu chí, verdict lệch, chấm hai lần, quá hạn", async () => {
    const { reviewers, byReviewer } = await setup();
    const [r1, r2, r3] = reviewers as [U, U, U];
    const a1 = byReviewer.get(r1.id)!;
    const full = await marksFor(a1, r1.id, true);
    await expect(
      submitReview(db, { assignmentId: a1, reviewerId: r2.id, verdict: "pass", marks: full, now: NOW }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      submitReview(db, { assignmentId: a1, reviewerId: r1.id, verdict: "pass", marks: full.slice(1), now: NOW }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      submitReview(db, {
        assignmentId: a1,
        reviewerId: r1.id,
        verdict: "pass",
        marks: [{ ...full[0]!, met: false }, full[1]!],
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      submitReview(db, { assignmentId: a1, reviewerId: r1.id, verdict: "fail", marks: full, now: NOW }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await submitReview(db, { assignmentId: a1, reviewerId: r1.id, verdict: "pass", marks: full, now: NOW });
    await expect(
      submitReview(db, { assignmentId: a1, reviewerId: r1.id, verdict: "pass", marks: full, now: NOW }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const a3 = byReviewer.get(r3.id)!;
    await expect(
      submitReview(db, {
        assignmentId: a3,
        reviewerId: r3.id,
        verdict: "pass",
        marks: await marksFor(a3, r3.id, true),
        now: new Date(NOW.getTime() + 49 * 3_600_000),
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("3 người chấm đồng thời → chốt đúng một lần, không deadlock", async () => {
    const { skill, submitter, reviewers, proofId, byReviewer } = await setup();
    const inputs = await Promise.all(
      reviewers.map(async (r) => ({
        assignmentId: byReviewer.get(r.id)!,
        reviewerId: r.id,
        verdict: "pass" as const,
        marks: await marksFor(byReviewer.get(r.id)!, r.id, true),
        now: NOW,
      })),
    );
    const res = await Promise.all(inputs.map((i) => submitReview(db, i)));
    expect(res.map((r) => r.finalize.outcome).sort()).toEqual(["passed", "waiting", "waiting"]);
    expect(await levelOf(submitter.id, skill.id)).toBe(2);
    expect(await db.xpLedger.count({ where: { refId: proofId, reason: "proof_passed" } })).toBe(1);
  });
});

describe("hàng đợi + màn duyệt ẩn danh", () => {
  it("không lộ id / handle / tên người nộp hay proofId", async () => {
    const { submitter, reviewers, proofId, byReviewer } = await setup();
    const r1 = reviewers[0]!;
    const queue = await getReviewQueue(db, { reviewerId: r1.id, now: NOW });
    expect(queue.reputation).toBe(60);
    const item = queue.items.find((i) => i.assignmentId === byReviewer.get(r1.id))!;
    expect(item).toMatchObject({ targetLevel: 2, votes: 0, required: 3, criteriaCount: 2 });
    expect(item.anonymousCode).toMatch(/^#[0-9A-F]{4}$/);
    const task = await getReviewTask(db, { assignmentId: item.assignmentId, reviewerId: r1.id, now: NOW });
    expect(task).toMatchObject({ canSubmit: true, anonymousCode: item.anonymousCode, myReview: null, reported: false });
    for (const payload of [JSON.stringify(queue), JSON.stringify(task)]) {
      expect(payload).not.toContain(submitter.id);
      expect(payload).not.toContain(submitter.handle);
      expect(payload).not.toContain(submitter.displayName);
      expect(payload).not.toContain(proofId);
    }
    await expect(
      getReviewTask(db, { assignmentId: item.assignmentId, reviewerId: reviewers[1]!.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("báo cáo trong lúc duyệt → reports + thông báo biên tập viên; không trùng", async () => {
    const { reviewers, proofId, byReviewer } = await setup();
    const r1 = reviewers[0]!;
    const a = byReviewer.get(r1.id)!;
    const { reportId } = await reportProofDuringReview(db, { assignmentId: a, reviewerId: r1.id, reason: "reused_video", details: "Video cũ", now: NOW });
    expect(await db.report.findUniqueOrThrow({ where: { id: reportId } })).toMatchObject({
      targetType: "proof",
      targetId: proofId,
      reason: "reused_video",
      status: "open",
    });
    expect(await db.notification.count({ where: { userId: editor.id, refId: reportId, kind: "report_filed" } })).toBe(1);
    await expect(
      reportProofDuringReview(db, { assignmentId: a, reviewerId: r1.id, reason: "edited" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      reportProofDuringReview(db, { assignmentId: a, reviewerId: reviewers[1]!.id, reason: "edited" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getReviewTask(db, { assignmentId: a, reviewerId: r1.id, now: NOW })).reported).toBe(true);
  });
});

describe("trạng thái, kháng nghị, vòng duyệt mới", () => {
  it("trượt → kết quả từng tiêu chí + nhận xét; kháng nghị overturned mở vòng mới người khác, chỉ tính phiếu vòng mới", async () => {
    const { skill, submitter, reviewers, extras, proofId, byReviewer } = await setup({ extraReviewers: 3 });
    const [r1, r2, r3] = reviewers as [U, U, U];

    const pending = await getProofStatus(db, { proofId, userId: submitter.id, now: NOW });
    expect(pending).toMatchObject({ status: "in_review", votes: 0, required: 3, criteria: null, comments: null, canAppeal: false });
    await expect(getProofStatus(db, { proofId, userId: r1.id })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await review(byReviewer.get(r1.id)!, r1.id, "fail", "Không thấy rõ tay");
    await review(byReviewer.get(r2.id)!, r2.id, "fail");
    const last = await review(byReviewer.get(r3.id)!, r3.id, "pass");
    expect(last.finalize.outcome).toBe("failed");

    const st = await getProofStatus(db, { proofId, userId: submitter.id, now: NOW });
    expect(st.status).toBe("failed");
    expect(st.criteria?.map((c) => [c.metCount, c.notMetCount])).toEqual([
      [1, 2],
      [3, 0],
    ]);
    expect(st.comments).toEqual(["Không thấy rõ tay"]);
    expect(st.canAppeal).toBe(true);
    expect(JSON.stringify(st)).not.toContain(r1.id);

    await expect(fileAppeal(db, { proofId, userId: r1.id, reason: "Tôi muốn kháng nghị" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      fileAppeal(db, { proofId, userId: submitter.id, reason: "Quá hạn rồi", now: new Date(NOW.getTime() + 8 * 86_400_000) }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const { appealId } = await fileAppeal(db, { proofId, userId: submitter.id, reason: "Góc quay khác cho thấy rõ tay", now: NOW });
    await expect(fileAppeal(db, { proofId, userId: submitter.id, reason: "Lần hai", now: NOW })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.notification.count({ where: { userId: editor.id, kind: "appeal_filed", refId: appealId } })).toBe(1);

    await expect(resolveAppeal(db, { appealId, editorId: r1.id, decision: "overturned" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const res = await resolveAppeal(db, { appealId, editorId: editor.id, decision: "overturned", now: NOW, rng });
    expect(res.status).toBe("overturned");
    expect(res.assignedReviewerIds.sort()).toEqual(extras.map((e) => e.id).sort());
    await expect(resolveAppeal(db, { appealId, editorId: editor.id, decision: "upheld" })).rejects.toMatchObject({ code: "CONFLICT" });

    const old = await db.reviewAssignment.findMany({ where: { proofId, reviewerId: { in: reviewers.map((r) => r.id) } } });
    expect(old.every((a) => a.state === "recused")).toBe(true);
    const reopened = await getProofStatus(db, { proofId, userId: submitter.id, now: NOW });
    expect(reopened).toMatchObject({ status: "in_review", votes: 0, appeal: { status: "overturned" } });

    const fresh = await db.reviewAssignment.findMany({ where: { proofId, state: "assigned" } });
    const outcomes = [];
    for (const a of fresh) outcomes.push((await review(a.id, a.reviewerId, "pass")).finalize.outcome);
    expect(outcomes).toEqual(["waiting", "waiting", "passed"]);
    expect(await levelOf(submitter.id, skill.id)).toBe(2);
    expect(await db.notification.count({ where: { userId: submitter.id, kind: "appeal_overturned" } })).toBe(1);
  });

  it("bằng chứng trùng hash → underEditorReview", async () => {
    const a = await setup();
    const h = (await db.proof.findUniqueOrThrow({ where: { id: a.proofId } })).mediaHash;
    const b = await setup({ reviewers: 0 });
    await fx.setUserSkillLevel(db, b.submitter.id, b.skill.id, 2);
    const dup = await submitProof(db, {
      userId: b.submitter.id,
      skillId: b.skill.id,
      targetLevel: 3,
      mediaUrl: "proofs/dup.mp4",
      mediaHash: h,
      now: NOW,
    }).catch((e: unknown) => e);
    // b đang có bằng chứng mở cho kỹ năng → CONFLICT; dùng kỹ năng khác
    expect(dup).toMatchObject({ code: "CONFLICT" });
    const other = await fx.skill(db, { categoryId: catId });
    const d2 = await submitProof(db, { userId: b.submitter.id, skillId: other.id, targetLevel: 1, mediaUrl: "proofs/dup.mp4", mediaHash: h, now: NOW });
    const st = await getProofStatus(db, { proofId: d2.proofId, userId: b.submitter.id, now: NOW });
    expect(st).toMatchObject({ status: "disputed", underEditorReview: true });
    expect(await db.notification.count({ where: { userId: b.submitter.id, kind: "proof_editor_review" } })).toBe(1);
  });
});

describe("lên cấp + thẻ chia sẻ", () => {
  it("tóm tắt lên cấp và thẻ công khai chỉ có tên hiển thị", async () => {
    const { skill, submitter, reviewers, proofId, byReviewer } = await setup();
    const child = await fx.skill(db, { categoryId: catId, name: "Kỹ năng con" });
    await fx.edge(db, skill.id, child.id, 2);
    const other: FxSkill = await fx.skill(db, { categoryId: catId, name: "Cần hai cha" });
    await fx.edge(db, skill.id, other.id, 2);
    const p2 = await fx.skill(db, { categoryId: catId });
    await fx.edge(db, p2.id, other.id, 1);

    await expect(getShareCard(db, { proofId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const r of reviewers) await review(byReviewer.get(r.id)!, r.id, "pass");

    const s = await getLevelUpSummary(db, { proofId, userId: submitter.id });
    expect(s).toMatchObject({
      level: 2,
      levelTitle: "Cấp 2",
      xpAwarded: 200,
      accountLevelBefore: 1,
      accountLevelAfter: 2,
      passVotes: 3,
      totalVotes: 3,
      badges: [expect.objectContaining({ slug: "first-proof" })],
      unlockedSkills: [{ slug: child.slug, name: "Kỹ năng con" }],
      displayName: "Nguyễn Bí Mật",
    });
    expect(s.topPercent).toBeGreaterThanOrEqual(1);
    await expect(getLevelUpSummary(db, { proofId, userId: reviewers[0]!.id })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const card = await getShareCard(db, { proofId });
    expect(card).toMatchObject({ displayName: "Nguyễn Bí Mật", level: 2, maxLevel: 5, verifiedCount: 3 });
    expect(JSON.stringify(card)).not.toContain(submitter.handle);
    expect(JSON.stringify(card)).not.toContain(submitter.id);
  });
});

describe("tác vụ nền", () => {
  it("weeklyReputationRecovery: +1 cho người dưới ngưỡng, idempotent trong tuần, bỏ qua người vừa bị trừ", async () => {
    const low = await fx.user(db, { reputation: 30 });
    const penalized = await fx.user(db, { reputation: 30 });
    await db.reputationEvent.create({ data: { userId: penalized.id, delta: -3, reason: "vote_mismatched", createdAt: new Date(NOW.getTime() - 86_400_000) } });
    const r1 = await weeklyReputationRecovery(db, { now: NOW });
    expect(r1.recovered).toBeGreaterThanOrEqual(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: low.id } })).reputation).toBe(31);
    expect((await db.user.findUniqueOrThrow({ where: { id: penalized.id } })).reputation).toBe(30);
    await weeklyReputationRecovery(db, { now: new Date(NOW.getTime() + 86_400_000) });
    expect((await db.user.findUniqueOrThrow({ where: { id: low.id } })).reputation).toBe(31);
    await weeklyReputationRecovery(db, { now: new Date(NOW.getTime() + 8 * 86_400_000) });
    expect((await db.user.findUniqueOrThrow({ where: { id: low.id } })).reputation).toBe(32);
  });

  it("createDomainJobHandlers chạy được qua InlineJobRunner", async () => {
    const runner = new InlineJobRunner(createDomainJobHandlers(db));
    await expect(runner.enqueue("closeExpiredProposals")).resolves.toBeUndefined();
    await expect(runner.enqueue("reassignExpiredReviews")).resolves.toBeUndefined();
  });
});
