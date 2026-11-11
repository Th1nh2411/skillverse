import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@skillverse/db";
import { getReviewTask, submitProof, submitReview } from "../src";
import { fx, type FxSkill } from "../src/testing";

export const NOW = new Date("2026-11-11T08:00:00Z");
export const rng = () => 0.42;
export const hash = () => createHash("sha256").update(randomBytes(16)).digest("hex");

type U = { id: string; handle: string; displayName: string };

/**
 * Kỹ năng mới + người nộp ở cấp `fromLevel` + 3 người duyệt (cấp 5, uy tín 60..62),
 * nộp cấp fromLevel+1 rồi chấm theo `verdicts` qua luồng domain thật.
 */
export async function proofThroughLoop(
  db: PrismaClient,
  o: { categoryId: string; fromLevel?: number; verdicts?: ("pass" | "fail")[]; holderCount?: number; maxLevel?: number },
) {
  const fromLevel = o.fromLevel ?? 0;
  const skill: FxSkill = await fx.skill(db, { categoryId: o.categoryId, holderCount: o.holderCount ?? 1000, maxLevel: o.maxLevel });
  const submitter: U = await fx.user(db);
  if (fromLevel > 0) await fx.setUserSkillLevel(db, submitter.id, skill.id, fromLevel);
  const reviewers: U[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await fx.user(db, { reputation: 60 + i });
    await fx.setUserSkillLevel(db, r.id, skill.id, 5);
    reviewers.push(r);
  }
  const { proofId } = await submitProof(db, {
    userId: submitter.id,
    skillId: skill.id,
    targetLevel: fromLevel + 1,
    mediaUrl: `proofs/${randomBytes(4).toString("hex")}.mp4`,
    mediaHash: hash(),
    safetyAck: true,
    now: NOW,
    rng,
  });
  const verdicts = o.verdicts ?? ["pass", "pass", "pass"];
  const assignments = await db.reviewAssignment.findMany({ where: { proofId }, orderBy: { reviewerId: "asc" } });
  for (const [i, a] of assignments.entries()) {
    const v = verdicts[i];
    if (!v) break;
    const task = await getReviewTask(db, { assignmentId: a.id, reviewerId: a.reviewerId, now: NOW });
    await submitReview(db, {
      assignmentId: a.id,
      reviewerId: a.reviewerId,
      verdict: v,
      marks: task.criteria.map((c, j) => ({ criterionId: c.id, met: v === "pass" || j > 0 })),
      now: NOW,
      rng,
    });
  }
  return { skill, submitter, reviewers, proofId, assignments };
}
