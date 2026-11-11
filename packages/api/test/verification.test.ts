import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "@skillverse/domain/testing";
import {
  appRouter,
  createCallerFactory,
  createContext,
  createSessionFor,
  getSessionUser,
  isProofMediaKeyOwnedBy,
  runCron,
  verifyCronSecret,
  type SessionUser,
} from "../src";
import { MemoryStorage } from "./helpers";

const db = getTestDb();
const storage = new MemoryStorage();
const createCaller = createCallerFactory(appRouter);
const caller = async (user: SessionUser | null) => createCaller(await createContext({ db, user, storage }));

let skill: FxSkill;
let submitter: SessionUser;
let reviewers: SessionUser[];
let outsider: SessionUser;
let proofId: string;
const VIDEO = Buffer.from("video-bytes-for-test-".repeat(100));

async function viewer(userId: string): Promise<SessionUser> {
  return (await getSessionUser(db, (await createSessionFor(db, userId)).sessionToken))!;
}

async function expectCode(p: Promise<unknown>, code: TRPCError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof TRPCError && e.code === code);
}

beforeAll(async () => {
  await resetDb(db);
  const cat = await fx.category(db, { slug: "sinh-ton", name: "Sinh tồn" });
  skill = await fx.skill(db, { categoryId: cat.id, slug: "that-nut-day", name: "Thắt nút dây", holderCount: 960 });
  const s = await fx.user(db, { handle: "nguoinop", displayName: "Người Nộp" });
  await fx.setUserSkillLevel(db, s.id, skill.id, 0);
  submitter = await viewer(s.id);
  reviewers = [];
  for (const h of ["duyet_a", "duyet_b", "duyet_c"]) {
    const r = await fx.user(db, { handle: h, reputation: 80 });
    await fx.setUserSkillLevel(db, r.id, skill.id, 3);
    reviewers.push(await viewer(r.id));
  }
  outsider = await viewer((await fx.user(db, { handle: "nguoingoai", reputation: 80 })).id);
});

afterAll(async () => {
  await closeTestDb();
});

describe("quyền: chưa đăng nhập", () => {
  it("procedure giai đoạn 2 trả UNAUTHORIZED (trừ share.card công khai)", async () => {
    const c = await caller(null);
    const id = "00000000-0000-4000-8000-000000000000";
    await expectCode(c.proof.createUpload({ contentType: "video/mp4", sizeBytes: 10 }), "UNAUTHORIZED");
    await expectCode(c.proof.status({ proofId: id }), "UNAUTHORIZED");
    await expectCode(c.proof.videoUrl({ proofId: id }), "UNAUTHORIZED");
    await expectCode(c.review.queue(), "UNAUTHORIZED");
    await expectCode(c.review.task({ assignmentId: id }), "UNAUTHORIZED");
    await expectCode(c.levelUp.summary({ proofId: id }), "UNAUTHORIZED");
    await expectCode(c.share.card({ proofId: id }), "NOT_FOUND");
  });
});

describe("upload video", () => {
  it("proof.limits đọc từ app_config.media_limits", async () => {
    const l = await (await caller(submitter)).proof.limits();
    expect(l).toMatchObject({ maxMb: 60, maxBytes: 60 * 1024 * 1024, maxSeconds: 180 });
    expect(l.allowedTypes).toContain("video/mp4");
    await expectCode((await caller(null)).proof.limits(), "UNAUTHORIZED");
  });

  it("chặn định dạng / dung lượng ngoài app_config.media_limits", async () => {
    const c = await caller(submitter);
    await expectCode(c.proof.createUpload({ contentType: "image/png", sizeBytes: 1000 }), "BAD_REQUEST");
    await expectCode(c.proof.createUpload({ contentType: "video/mp4", sizeBytes: 61 * 1024 * 1024 }), "BAD_REQUEST");
  });

  it("khóa ngẫu nhiên không chứa dữ liệu cá nhân, gắn với người xin", async () => {
    const c = await caller(submitter);
    const up = await c.proof.createUpload({ contentType: "video/mp4", sizeBytes: VIDEO.length });
    expect(up.mediaKey).toMatch(/^proofs\/[0-9a-f-]{36}-[0-9a-f]{24}\.mp4$/);
    expect(up.mediaKey).not.toContain(submitter.id);
    expect(up.mediaKey).not.toContain(submitter.handle);
    expect(up.headers["Content-Type"]).toBe("video/mp4");
    expect(isProofMediaKeyOwnedBy(up.mediaKey, submitter.id)).toBe(true);
    expect(isProofMediaKeyOwnedBy(up.mediaKey, outsider.id)).toBe(false);
  });

  it("nộp bằng khóa của người khác / chưa tải lên / sai định dạng → BAD_REQUEST", async () => {
    const mine = await (await caller(submitter)).proof.createUpload({ contentType: "video/mp4", sizeBytes: VIDEO.length });
    storage.put(mine.mediaKey, VIDEO, "video/mp4");
    const base = { skillId: skill.id, targetLevel: 1, safetyAck: true };
    await expectCode((await caller(outsider)).proof.submit({ ...base, mediaKey: mine.mediaKey }), "BAD_REQUEST");

    const notUploaded = await (await caller(submitter)).proof.createUpload({ contentType: "video/mp4", sizeBytes: 10 });
    await expectCode((await caller(submitter)).proof.submit({ ...base, mediaKey: notUploaded.mediaKey }), "BAD_REQUEST");

    const wrongType = await (await caller(submitter)).proof.createUpload({ contentType: "video/webm", sizeBytes: 10 });
    storage.put(wrongType.mediaKey, Buffer.from("x"), "text/html");
    await expectCode((await caller(submitter)).proof.submit({ ...base, mediaKey: wrongType.mediaKey }), "BAD_REQUEST");
    expect(storage.objects.has(wrongType.mediaKey)).toBe(false); // object sai bị xóa
  });

  it("nộp hợp lệ: server tính SHA-256, phân công đủ người duyệt, không lộ danh tính người duyệt", async () => {
    const c = await caller(submitter);
    const up = await c.proof.createUpload({ contentType: "video/mp4", sizeBytes: VIDEO.length });
    storage.put(up.mediaKey, VIDEO, "video/mp4");
    const r = await c.proof.submit({ skillId: skill.id, targetLevel: 1, mediaKey: up.mediaKey, durationS: 30, safetyAck: true });
    expect(r).toMatchObject({ status: "in_review", duplicate: false, reviewersAssigned: 3 });
    expect(r).not.toHaveProperty("assignedReviewerIds");
    proofId = r.proofId;
    const row = await db.proof.findUniqueOrThrow({ where: { id: proofId } });
    expect(row.mediaHash).toBe(createHash("sha256").update(VIDEO).digest("hex"));
    expect(row.mediaUrl).toBe(up.mediaKey);

    // Dùng lại cùng khóa → chặn
    await expectCode(
      c.proof.submit({ skillId: skill.id, targetLevel: 1, mediaKey: up.mediaKey, safetyAck: true }),
      "BAD_REQUEST",
    );
  });
});

describe("duyệt + quyền xem video", () => {
  it("người nộp xem trạng thái + video; người ngoài không xem được", async () => {
    const st = await (await caller(submitter)).proof.status({ proofId });
    expect(st.video.url).toContain("https://storage.test/get/");
    expect(st).not.toHaveProperty("mediaKey");
    await expectCode((await caller(outsider)).proof.videoUrl({ proofId }), "FORBIDDEN");
    await expectCode((await caller(outsider)).proof.status({ proofId }), "FORBIDDEN");
  });

  it("hàng đợi + task ẩn danh cho người được phân công; người không được phân công bị chặn", async () => {
    const q = await (await caller(reviewers[0]!)).review.queue();
    expect(q.items).toHaveLength(1);
    const assignmentId = q.items[0]!.assignmentId;
    const task = await (await caller(reviewers[0]!)).review.task({ assignmentId });
    expect(task.video?.url).toContain("https://storage.test/get/");
    const json = JSON.stringify(task);
    expect(json).not.toContain(submitter.id);
    expect(json).not.toContain(submitter.handle);
    expect(json).not.toContain("Người Nộp");
    expect(json).not.toContain(proofId);
    expect(task).not.toHaveProperty("mediaKey");

    await expect((await caller(outsider)).review.task({ assignmentId })).rejects.toBeInstanceOf(TRPCError);
    const marks = task.criteria.map((c: { id: string }) => ({ criterionId: c.id, met: true }));
    await expect((await caller(outsider)).review.submit({ assignmentId, verdict: "pass", marks })).rejects.toBeInstanceOf(
      TRPCError,
    );
    // Người được phân công xem được video (qua quyền canViewProofMedia)
    expect((await (await caller(reviewers[0]!)).proof.videoUrl({ proofId })).url).toContain("storage.test");
  });

  it("3 người chấm Đạt → lên cấp; levelUp.summary + share.card công khai", async () => {
    let outcome = "";
    for (const r of reviewers) {
      const c = await caller(r);
      const q = await c.review.queue();
      const assignmentId = q.items[0]!.assignmentId;
      const task = await c.review.task({ assignmentId });
      const marks = task.criteria.map((x: { id: string }) => ({ criterionId: x.id, met: true }));
      // verdict không khớp tiêu chí → BAD_REQUEST (Zod)
      await expectCode(c.review.submit({ assignmentId, verdict: "fail", marks }), "BAD_REQUEST");
      const res = await c.review.submit({ assignmentId, verdict: "pass", marks });
      expect(res).not.toHaveProperty("finalize");
      outcome = res.outcome;
    }
    expect(outcome).toBe("passed");
    const us = await db.userSkill.findFirstOrThrow({ where: { userId: submitter.id, skillId: skill.id } });
    expect(us.level).toBe(1);

    const sum = await (await caller(submitter)).levelUp.summary({ proofId });
    expect(sum.level).toBe(1);
    await expect((await caller(outsider)).levelUp.summary({ proofId })).rejects.toBeInstanceOf(TRPCError);

    const card = await (await caller(null)).share.card({ proofId });
    expect(card).toMatchObject({ proofId, displayName: "Người Nộp", level: 1 });
    expect(JSON.stringify(card)).not.toContain(submitter.handle);
    // Bằng chứng đã đạt → người đăng nhập bất kỳ xem được video
    expect((await (await caller(outsider)).proof.videoUrl({ proofId })).url).toContain("storage.test");
  });
});

describe("cron", () => {
  it("secret: sai / thiếu → false, đúng (Bearer hoặc x-cron-secret) → true", () => {
    expect(verifyCronSecret(new Headers(), "s3cret")).toBe(false);
    expect(verifyCronSecret(new Headers({ authorization: "Bearer sai" }), "s3cret")).toBe(false);
    expect(verifyCronSecret(new Headers({ authorization: "Bearer s3cret" }), undefined)).toBe(false);
    expect(verifyCronSecret(new Headers({ authorization: "Bearer s3cret" }), "s3cret")).toBe(true);
    expect(verifyCronSecret(new Headers({ "x-cron-secret": "s3cret" }), "s3cret")).toBe(true);
  });

  it("runCron chạy đủ 3 tác vụ, idempotent, lỗi một tác vụ không chặn tác vụ khác", async () => {
    const r1 = await runCron(db);
    expect(Object.keys(r1).sort()).toEqual(["closeDuels", "closeExpiredProposals", "reassignExpiredReviews", "weeklyReputationRecovery"]);
    expect(Object.values(r1).every((j) => j?.ok)).toBe(true);
    const r2 = await runCron(db, {
      reassignExpiredReviews: async () => {
        throw new Error("hỏng");
      },
      closeExpiredProposals: async () => ({ closed: 0 }),
      weeklyReputationRecovery: async () => ({ recovered: 0 }),
    });
    expect(r2.reassignExpiredReviews).toMatchObject({ ok: false, error: "hỏng" });
    expect(r2.weeklyReputationRecovery).toMatchObject({ ok: true });
  });
});
