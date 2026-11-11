import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignReviewers,
  createReport,
  createTextPost,
  fileAppeal,
  finalizeProof,
  getShareCard,
  listAppeals,
  listDisputedProofs,
  listReports,
  resolveDisputedProof,
  resolveReport,
  sanctionUser,
  submitProof,
} from "../src";
import { closeTestDb, fx, getTestDb, resetDb } from "../src/testing";
import { NOW, hash, proofThroughLoop, rng } from "./helpers";

const db = getTestDb();
let catId: string;
let editor: { id: string };
let reporter: { id: string };

beforeAll(async () => {
  await resetDb(db);
  catId = (await fx.category(db)).id;
  editor = await fx.user(db, { isEditor: true, reputation: 95 });
  reporter = await fx.user(db);
});

afterAll(async () => {
  await closeTestDb();
});

const levelOf = async (userId: string, skillId: string) =>
  (await db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId } } }))?.level ?? 0;

describe("báo cáo → thu hồi level qua finalizeProof (D40)", () => {
  it("xác nhận gian lận bằng chứng đã đạt cấp cao nhất: sanction, level −1, XP âm, holder_count −1, −15 uy tín người duyệt đạt", async () => {
    const { skill, submitter, reviewers, proofId } = await proofThroughLoop(db, { categoryId: catId, fromLevel: 4, holderCount: 10 });
    expect(await levelOf(submitter.id, skill.id)).toBe(5);
    expect((await db.skill.findUniqueOrThrow({ where: { id: skill.id } })).holderCount).toBe(11);
    const xpBefore = (await db.user.findUniqueOrThrow({ where: { id: submitter.id } })).totalXp;
    const repBefore = await Promise.all(reviewers.map((r) => db.user.findUniqueOrThrow({ where: { id: r.id } })));

    const { reportId } = await createReport(db, { reporterId: reporter.id, targetType: "proof", targetId: proofId, reason: "reused_video", now: NOW });
    const second = await createReport(db, { reporterId: (await fx.user(db)).id, targetType: "proof", targetId: proofId, reason: "edited", now: NOW });
    const list = await listReports(db, { editorId: editor.id });
    expect(list.items.find((i) => i.id === reportId)).toMatchObject({ openReportsOnTarget: 2, target: { proofStatus: "passed" } });

    const res = await resolveReport(db, { reportId, editorId: editor.id, decision: "confirmed", outcome: "Video trùng nguồn", now: NOW });
    expect(res.action).toBe("level_revoked");
    expect(res.revoke).toMatchObject({ outcome: "revoked", previousLevel: 5, newLevel: 4, xpRevoked: 500 });

    expect(await levelOf(submitter.id, skill.id)).toBe(4);
    expect((await db.skill.findUniqueOrThrow({ where: { id: skill.id } })).holderCount).toBe(10);
    const u = await db.user.findUniqueOrThrow({ where: { id: submitter.id } });
    expect(u.totalXp).toBe(xpBefore - 500);
    expect(await db.xpLedger.findFirst({ where: { refId: proofId, reason: "revoked" } })).toMatchObject({ amount: -500 });
    expect(await db.sanction.findFirst({ where: { proofId } })).toMatchObject({ kind: "level_revoked", reportId, createdBy: editor.id });
    for (const [i, r] of reviewers.entries()) {
      const after = await db.user.findUniqueOrThrow({ where: { id: r.id } });
      // +1 khi chốt đạt, −15 khi thu hồi
      expect(after.reputation).toBe(repBefore[i]!.reputation - 15);
      expect(await db.reputationEvent.count({ where: { userId: r.id, reason: "approved_fraud", refId: proofId } })).toBe(1);
    }
    expect((await db.proof.findUniqueOrThrow({ where: { id: proofId } })).status).toBe("removed");
    expect(await db.post.count({ where: { proofId, deletedAt: null } })).toBe(0);
    expect(await db.post.count({ where: { proofId } })).toBe(1); // không xóa bản ghi
    await expect(getShareCard(db, { proofId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Báo cáo thứ hai trên cùng bằng chứng được đóng cùng kết luận
    expect((await db.report.findUniqueOrThrow({ where: { id: second.reportId } })).status).toBe("confirmed");
    // Idempotent
    expect(
      await finalizeProof(db, { proofId, revoke: { byUserId: editor.id, reason: "lần 2" }, now: NOW }),
    ).toEqual({ outcome: "already_revoked", proofId });
    expect(await levelOf(submitter.id, skill.id)).toBe(4);
    await expect(resolveReport(db, { reportId, editorId: editor.id, decision: "dismissed" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("thu hồi chỉ áp dụng bằng chứng đã đạt; báo cáo bằng chứng đang duyệt → removed", async () => {
    const { proofId, assignments } = await proofThroughLoop(db, { categoryId: catId, verdicts: ["pass"] });
    await expect(
      finalizeProof(db, { proofId, revoke: { byUserId: editor.id, reason: "x" }, now: NOW }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const { reportId } = await createReport(db, { reporterId: reporter.id, targetType: "proof", targetId: proofId, reason: "not_self", now: NOW });
    const res = await resolveReport(db, { reportId, editorId: editor.id, decision: "confirmed", now: NOW });
    expect(res.action).toBe("proof_removed");
    expect((await db.proof.findUniqueOrThrow({ where: { id: proofId } })).status).toBe("removed");
    const states = await db.reviewAssignment.findMany({ where: { id: { in: assignments.map((a) => a.id) } } });
    expect(states.map((s) => s.state).sort()).toEqual(["done", "recused", "recused"]);
  });

  it("createReport: không tự báo cáo, không trùng, đối tượng phải tồn tại; dismissed không đổi gì", async () => {
    const author = await fx.user(db);
    const { postId } = await createTextPost(db, { userId: author.id, body: "Bài viết" });
    await expect(createReport(db, { reporterId: author.id, targetType: "post", targetId: postId, reason: "other" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      createReport(db, { reporterId: reporter.id, targetType: "post", targetId: "00000000-0000-4000-8000-000000000000", reason: "other" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { reportId } = await createReport(db, { reporterId: reporter.id, targetType: "post", targetId: postId, reason: "harassment" });
    await expect(createReport(db, { reporterId: reporter.id, targetType: "post", targetId: postId, reason: "harassment" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.notification.count({ where: { userId: editor.id, kind: "report_filed", refId: reportId } })).toBe(1);
    await expect(listReports(db, { editorId: reporter.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resolveReport(db, { reportId, editorId: reporter.id, decision: "confirmed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const r = await resolveReport(db, { reportId, editorId: editor.id, decision: "dismissed" });
    expect(r).toMatchObject({ status: "dismissed", action: null, revoke: null });
    expect((await db.post.findUniqueOrThrow({ where: { id: postId } })).deletedAt).toBeNull();
    expect(await db.notification.count({ where: { userId: reporter.id, kind: "report_dismissed" } })).toBe(1);

    const { reportId: r2 } = await createReport(db, { reporterId: reporter.id, targetType: "post", targetId: postId, reason: "harassment" });
    expect((await resolveReport(db, { reportId: r2, editorId: editor.id, decision: "confirmed" })).action).toBe("post_hidden");
    expect((await db.post.findUniqueOrThrow({ where: { id: postId } })).deletedAt).not.toBeNull();
  });
});

describe("sanctionUser", () => {
  it("review_ban: gỡ lượt duyệt đang chờ, gán người khác, không được phân công tiếp", async () => {
    const skill = await fx.skill(db, { categoryId: catId });
    const submitter = await fx.user(db);
    const rs = [];
    for (let i = 0; i < 4; i++) {
      const r = await fx.user(db, { reputation: 70 });
      await fx.setUserSkillLevel(db, r.id, skill.id, 5);
      rs.push(r);
    }
    const { assignedReviewerIds } = await submitProof(db, {
      userId: submitter.id, skillId: skill.id, targetLevel: 1, mediaUrl: "proofs/x.mp4", mediaHash: hash(), now: NOW, rng,
    });
    const banned = assignedReviewerIds[0]!;
    const free = rs.find((r) => !assignedReviewerIds.includes(r.id))!;
    await expect(sanctionUser(db, { editorId: reporter.id, userId: banned, kind: "review_ban", reason: "Thông đồng" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const s = await sanctionUser(db, { editorId: editor.id, userId: banned, kind: "review_ban", reason: "Thông đồng", durationDays: 30, now: NOW });
    expect(s.endsAt?.getTime()).toBe(NOW.getTime() + 30 * 86_400_000);
    const as = await db.reviewAssignment.findMany({ where: { proof: { userId: submitter.id } } });
    expect(as.find((a) => a.reviewerId === banned)?.state).toBe("recused");
    expect(as.find((a) => a.reviewerId === free.id)?.state).toBe("assigned");
    expect(await db.notification.count({ where: { userId: banned, kind: "sanction_review_ban" } })).toBe(1);

    const other = await fx.proof(db, { userId: (await fx.user(db)).id, skill, targetLevel: 1 });
    const r = await assignReviewers(db, { proofId: other.id, count: 10, now: NOW, rng });
    expect(r.assignedReviewerIds).not.toContain(banned);
  });

  it("post_ban chặn đăng bài; hết hạn thì đăng lại được; warning không có hạn", async () => {
    const u = await fx.user(db);
    await sanctionUser(db, { editorId: editor.id, userId: u.id, kind: "post_ban", reason: "Spam", durationDays: 1, now: NOW });
    await expect(createTextPost(db, { userId: u.id, body: "Xin chào", now: NOW })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createTextPost(db, { userId: u.id, body: "Xin chào", now: new Date(NOW.getTime() + 2 * 86_400_000) })).resolves.toBeTruthy();
    const w = await sanctionUser(db, { editorId: editor.id, userId: u.id, kind: "warning", reason: "Nhắc nhở", durationDays: 5 });
    expect(w.endsAt).toBeNull();
    await expect(sanctionUser(db, { editorId: editor.id, userId: editor.id, kind: "warning", reason: "Tự phạt" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("hàng đợi biên tập: trùng hash + kháng nghị", () => {
  it("listDisputedProofs hiện bằng chứng trùng; clear → vào vòng duyệt, remove → removed", async () => {
    const a = await proofThroughLoop(db, { categoryId: catId, verdicts: [] });
    const h = (await db.proof.findUniqueOrThrow({ where: { id: a.proofId } })).mediaHash;
    const mk = async () => {
      const skill = await fx.skill(db, { categoryId: catId });
      const u = await fx.user(db);
      for (let i = 0; i < 3; i++) {
        const r = await fx.user(db, { reputation: 70 });
        await fx.setUserSkillLevel(db, r.id, skill.id, 5);
      }
      return submitProof(db, { userId: u.id, skillId: skill.id, targetLevel: 1, mediaUrl: "proofs/dup.mp4", mediaHash: h, now: NOW, rng });
    };
    const d1 = await mk();
    const d2 = await mk();
    const q = await listDisputedProofs(db, { editorId: editor.id });
    const item = q.find((x) => x.proofId === d1.proofId)!;
    expect(item.signals[0]).toMatchObject({ signal: "duplicate_hash" });
    expect(item.matches.map((m) => m.proofId)).toContain(a.proofId);

    const c = await resolveDisputedProof(db, { proofId: d1.proofId, editorId: editor.id, decision: "clear", now: NOW, rng });
    expect(c.status).toBe("in_review");
    expect(c.assignedReviewerIds).toHaveLength(3);
    const r = await resolveDisputedProof(db, { proofId: d2.proofId, editorId: editor.id, decision: "remove", now: NOW });
    expect(r.status).toBe("removed");
    await expect(resolveDisputedProof(db, { proofId: d2.proofId, editorId: editor.id, decision: "remove" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(listDisputedProofs(db, { editorId: reporter.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("listAppeals trả kháng nghị đang mở kèm phiếu vòng quyết định", async () => {
    const { submitter, proofId } = await proofThroughLoop(db, { categoryId: catId, verdicts: ["fail", "fail", "pass"] });
    await fileAppeal(db, { proofId, userId: submitter.id, reason: "Góc quay khác rõ hơn", now: NOW });
    const list = await listAppeals(db, { editorId: editor.id });
    expect(list.find((a) => a.proof.proofId === proofId)).toMatchObject({ status: "open", proof: { passVotes: 1, totalVotes: 3 } });
  });
});
