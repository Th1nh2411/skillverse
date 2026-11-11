import { createPrismaClient, type PrismaClient } from "@skillverse/db";
import { assertE2eDatabase, E2E_DATABASE_URL } from "../env";

/**
 * Truy cập DB e2e CHỈ ĐỂ ĐỌC/kiểm chứng trong test (tra người được phân công, xác nhận level đã tăng).
 * Không ghi gì vào DB từ test — mọi thay đổi phải đi qua ứng dụng.
 */
let client: PrismaClient | undefined;

export function e2eDb(): PrismaClient {
  if (!client) {
    assertE2eDatabase(E2E_DATABASE_URL);
    client = createPrismaClient(E2E_DATABASE_URL);
  }
  return client;
}

export async function closeE2eDb(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

export async function userSkillLevel(handle: string, skillSlug: string): Promise<number> {
  const us = await e2eDb().userSkill.findFirst({
    where: { user: { handle }, skill: { slug: skillSlug } },
    select: { level: true },
  });
  return us?.level ?? 0;
}

/** Người được phân công (state assigned) của một bằng chứng → handle. */
export async function assignedReviewerHandles(proofId: string): Promise<string[]> {
  const rows = await e2eDb().reviewAssignment.findMany({
    where: { proofId, state: "assigned" },
    select: { reviewer: { select: { handle: true } } },
    orderBy: { assignedAt: "asc" },
  });
  return rows.map((r) => r.reviewer.handle);
}

export async function assignmentIdFor(proofId: string, handle: string): Promise<string | null> {
  const row = await e2eDb().reviewAssignment.findFirst({
    where: { proofId, reviewer: { handle } },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function proofRow(proofId: string) {
  return e2eDb().proof.findUnique({
    where: { id: proofId },
    select: { status: true, mediaUrl: true, userId: true, targetLevel: true, appeal: { select: { status: true } } },
  });
}

/** Bằng chứng mới nhất của người dùng cho kỹ năng (khi UI không đưa id lên URL). */
export async function latestProofId(handle: string, skillSlug: string): Promise<string | null> {
  const row = await e2eDb().proof.findFirst({
    where: { user: { handle }, skill: { slug: skillSlug } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** Người dùng seed có thể duyệt nhưng KHÔNG được phân công cho bằng chứng này (và không phải người nộp). */
export async function nonAssignedReviewerHandle(proofId: string): Promise<string> {
  const proof = await e2eDb().proof.findUniqueOrThrow({ where: { id: proofId }, select: { userId: true } });
  const assigned = await e2eDb().reviewAssignment.findMany({ where: { proofId }, select: { reviewerId: true } });
  const exclude = new Set([proof.userId, ...assigned.map((a) => a.reviewerId)]);
  const users = await e2eDb().user.findMany({
    where: { onboardedAt: { not: null }, isEditor: false },
    select: { id: true, handle: true },
    orderBy: { handle: "asc" },
  });
  const u = users.find((x) => !exclude.has(x.id));
  if (!u) throw new Error("Không còn người dùng seed nào ngoài danh sách phân công");
  return u.handle;
}
