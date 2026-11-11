import fs from "node:fs";
import { expect, type APIRequestContext } from "@playwright/test";
import { assignedReviewerHandles, assignmentIdFor, e2eDb } from "./db";
import { devToken, skipIfNoProcedure, trpcMutation, trpcQuery } from "./trpc";

/**
 * Vòng xác thực qua API (giả lập client mobile, Bearer): createUpload → PUT presigned (MinIO) → proof.submit,
 * rồi từng người được phân công review.task + review.submit. Dùng làm bước chuẩn bị cho test giai đoạn 3
 * (cần một bằng chứng ĐÃ ĐẠT có người duyệt thật) mà không phụ thuộc màn hình.
 */
export async function submitProofViaApi(
  request: APIRequestContext,
  opts: { handle: string; skillSlug: string; targetLevel: number; file: string; safetyAck?: boolean },
): Promise<string> {
  const token = await devToken(request, opts.handle);
  const body = fs.readFileSync(opts.file);
  const up = await trpcMutation(request, token, "proof.createUpload", { contentType: "video/webm", sizeBytes: body.length });
  skipIfNoProcedure(up, "proof.createUpload");
  expect(up.status, up.raw.slice(0, 300)).toBe(200);
  const { uploadUrl, mediaKey, headers } = up.data as { uploadUrl: string; mediaKey: string; headers: Record<string, string> };
  expect(mediaKey, "Khóa object không được chứa dữ liệu cá nhân").not.toContain(opts.handle);

  const put = await request.put(uploadUrl, { headers, data: body, failOnStatusCode: false });
  expect(put.status(), `PUT presigned: ${put.status()}`).toBeLessThan(300);

  const skill = await e2eDb().skill.findUniqueOrThrow({ where: { slug: opts.skillSlug }, select: { id: true } });
  const sub = await trpcMutation(request, token, "proof.submit", {
    skillId: skill.id,
    targetLevel: opts.targetLevel,
    mediaKey,
    durationS: 3,
    safetyAck: opts.safetyAck ?? false,
    caption: "Bằng chứng e2e (API)",
  });
  expect(sub.status, sub.raw.slice(0, 300)).toBe(200);
  const out = sub.data as { proofId: string; reviewersAssigned?: number };
  return out.proofId;
}

/** Mọi người được phân công chấm cùng một kết luận; trả về danh sách handle người duyệt. */
export async function reviewAllViaApi(request: APIRequestContext, proofId: string, verdict: "pass" | "fail"): Promise<string[]> {
  const reviewers = await assignedReviewerHandles(proofId);
  expect(reviewers.length, "Phải có 3 người được phân công").toBe(3);
  for (const reviewer of reviewers) {
    const assignmentId = await assignmentIdFor(proofId, reviewer);
    const token = await devToken(request, reviewer);
    const task = await trpcQuery(request, token, "review.task", { assignmentId });
    expect(task.status, task.raw.slice(0, 300)).toBe(200);
    const criteria = (task.data as { criteria: { id: string }[] }).criteria;
    const res = await trpcMutation(request, token, "review.submit", {
      assignmentId,
      verdict,
      marks: criteria.map((c) => ({ criterionId: c.id, met: verdict === "pass" })),
      comment: verdict === "pass" ? "Đạt đủ tiêu chí." : "Chưa đạt.",
    });
    expect(res.status, res.raw.slice(0, 300)).toBe(200);
  }
  return reviewers;
}

/** Số dòng của các bảng không được phép mất bản ghi (để chứng minh "không xóa gì"). */
export async function recordCounts() {
  const db = e2eDb();
  const [proofs, reviews, reviewMarks, xpLedger, reputationEvents, userSkills, posts, assignments] = await Promise.all([
    db.proof.count(),
    db.review.count(),
    db.reviewMark.count(),
    db.xpLedger.count(),
    db.reputationEvent.count(),
    db.userSkill.count(),
    db.post.count(),
    db.reviewAssignment.count(),
  ]);
  return { proofs, reviews, reviewMarks, xpLedger, reputationEvents, userSkills, posts, assignments };
}
