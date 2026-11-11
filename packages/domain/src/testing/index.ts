/**
 * Hạ tầng test dùng chung (domain + api): kết nối DB test, reset, fixture builder.
 * Import: `import { getTestDb, resetDb, fx } from "@skillverse/domain/testing"`.
 *
 * CHỈ dùng trong test. Fixture `setUserSkillLevel` ghi level trực tiếp để dựng dữ liệu đầu vào
 * (giống seed — DECISIONS D13); code ứng dụng chỉ ghi level trong finalizeProof().
 */
import { randomBytes } from "node:crypto";
import { createPrismaClient, type PrismaClient, type CriterionKind, type RiskLevel } from "@skillverse/db";
import type { Db } from "../db";

export const DEFAULT_TEST_DATABASE_URL = "postgresql://skillverse:skillverse@localhost:5433/skillverse_test";

let client: PrismaClient | undefined;

/** PrismaClient tới DB test (TEST_DATABASE_URL hoặc skillverse_test). Từ chối nếu không phải DB *_test. */
export function getTestDb(): PrismaClient {
  if (!client) {
    const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
    const dbName = new URL(url).pathname.replace(/^\//, "");
    if (!/_test($|_)/.test(dbName)) throw new Error(`Từ chối chạy test trên DB không phải *_test: ${dbName}`);
    client = createPrismaClient(url);
  }
  return client;
}

export async function closeTestDb(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}

/** Xóa sạch mọi bảng dữ liệu (giữ app_config và _prisma_migrations). */
export async function resetDb(db: PrismaClient): Promise<void> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('app_config', '_prisma_migrations')`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Ghi đè một khóa app_config trong test (nhớ khôi phục nếu đổi). */
export async function setConfig(db: Db, key: string, value: unknown): Promise<void> {
  await db.appConfig.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}

function uid(): string {
  return randomBytes(4).toString("hex");
}

export type FxSkill = {
  id: string;
  slug: string;
  name: string;
  maxLevel: number;
  /** level → { levelId, versionId, criteriaIds } */
  levels: Map<number, { levelId: string; versionId: string; criteriaIds: string[] }>;
};

export const fx = {
  async category(db: Db, o: { slug?: string; name?: string } = {}) {
    const s = o.slug ?? `cat-${uid()}`;
    return db.category.create({ data: { slug: s, name: o.name ?? `Danh mục ${s}` } });
  },

  async user(
    db: Db,
    o: Partial<{
      handle: string;
      displayName: string;
      reputation: number;
      isEditor: boolean;
      totalXp: number;
      homeCell: string | null;
      shareLocation: boolean;
      onboarded: boolean;
      status: "active" | "restricted" | "banned";
    }> = {},
  ) {
    const h = o.handle ?? `u_${uid()}`;
    return db.user.create({
      data: {
        handle: h,
        displayName: o.displayName ?? `Người ${h}`,
        email: `${h}@test.skillverse.local`,
        reputation: o.reputation ?? 50,
        isEditor: o.isEditor ?? false,
        totalXp: o.totalXp ?? 0,
        homeCell: o.homeCell ?? null,
        shareLocation: o.shareLocation ?? false,
        onboardedAt: o.onboarded === false ? null : new Date(),
        status: o.status ?? "active",
      },
    });
  },

  /** Kỹ năng có `maxLevel` cấp, mỗi cấp có criteria_versions v1 (mặc định 2 tiêu chí). */
  async skill(
    db: Db,
    o: {
      categoryId: string;
      slug?: string;
      name?: string;
      maxLevel?: number;
      holderCount?: number;
      riskLevel?: RiskLevel;
      status?: "proposed" | "active" | "archived";
      minReviewers?: number;
      /** level → min_reviewer_level; mặc định max(1, level−1). */
      minReviewerLevel?: (level: number) => number;
      criteria?: (level: number) => string[];
      createdAt?: Date;
    },
  ): Promise<FxSkill> {
    const slug = o.slug ?? `skill-${uid()}`;
    const maxLevel = o.maxLevel ?? 5;
    const skill = await db.skill.create({
      data: {
        slug,
        name: o.name ?? `Kỹ năng ${slug}`,
        categoryId: o.categoryId,
        status: o.status ?? "active",
        maxLevel,
        holderCount: o.holderCount ?? 0,
        riskLevel: o.riskLevel ?? "none",
        ...(o.createdAt ? { createdAt: o.createdAt } : {}),
      },
    });
    const levels: FxSkill["levels"] = new Map();
    for (let lv = 1; lv <= maxLevel; lv++) {
      const sl = await db.skillLevel.create({
        data: {
          skillId: skill.id,
          level: lv,
          title: `Cấp ${lv}`,
          xpReward: 100 * lv,
          minReviewers: o.minReviewers ?? 3,
          minReviewerLevel: o.minReviewerLevel ? o.minReviewerLevel(lv) : Math.max(1, lv - 1),
        },
      });
      const texts = o.criteria ? o.criteria(lv) : [`Tiêu chí A cấp ${lv}`, `Tiêu chí B cấp ${lv}`];
      const version = await db.criteriaVersion.create({
        data: {
          skillLevelId: sl.id,
          version: 1,
          criteria: {
            create: texts.map((text, i) => ({ position: i + 1, text, kind: "checklist" as CriterionKind })),
          },
        },
        include: { criteria: { orderBy: { position: "asc" } } },
      });
      await db.skillLevel.update({ where: { id: sl.id }, data: { currentVersionId: version.id } });
      levels.set(lv, { levelId: sl.id, versionId: version.id, criteriaIds: version.criteria.map((c) => c.id) });
    }
    return { id: skill.id, slug, name: skill.name, maxLevel, levels };
  },

  async edge(db: Db, parentSkillId: string, childSkillId: string, requiredLevel = 1) {
    return db.skillEdge.create({ data: { parentSkillId, childSkillId, requiredLevel } });
  },

  /** CHỈ fixture test: đặt level trực tiếp (xem chú thích đầu file). */
  async setUserSkillLevel(db: Db, userId: string, skillId: string, level: number) {
    return db.userSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      update: { level },
      create: { userId, skillId, level },
    });
  },

  async follow(db: Db, followerId: string, followeeId: string) {
    return db.follow.create({ data: { followerId, followeeId } });
  },

  /** Bằng chứng tạo thẳng (không qua submitProof) — dùng dựng dữ liệu đầu vào. */
  async proof(
    db: Db,
    o: {
      userId: string;
      skill: FxSkill;
      targetLevel: number;
      status?: "pending" | "in_review" | "passed" | "failed" | "disputed" | "removed";
      mediaHash?: string;
      createdAt?: Date;
    },
  ) {
    const lv = o.skill.levels.get(o.targetLevel);
    if (!lv) throw new Error(`Kỹ năng không có cấp ${o.targetLevel}`);
    return db.proof.create({
      data: {
        userId: o.userId,
        skillId: o.skill.id,
        targetLevel: o.targetLevel,
        criteriaVersionId: lv.versionId,
        mediaUrl: `test/${uid()}.mp4`,
        mediaHash: o.mediaHash ?? randomBytes(32).toString("hex"),
        status: o.status ?? "pending",
        safetyAck: true,
        ...(o.createdAt ? { createdAt: o.createdAt } : {}),
        ...(o.status === "passed" || o.status === "failed" ? { decidedAt: new Date() } : {}),
      },
    });
  },

  async post(db: Db, o: { authorId: string; skillId: string; createdAt?: Date; kind?: "text" | "level_up" | "proof" }) {
    return db.post.create({
      data: { authorId: o.authorId, skillId: o.skillId, kind: o.kind ?? "text", body: "test", ...(o.createdAt ? { createdAt: o.createdAt } : {}) },
    });
  },

  /** Ghi phiếu duyệt cho một phân công (state → done) kèm review_marks. */
  async review(db: Db, o: { assignmentId: string; verdict: "pass" | "fail"; comment?: string }) {
    const a = await db.reviewAssignment.findUniqueOrThrow({
      where: { id: o.assignmentId },
      include: { proof: { include: { criteriaVersion: { include: { criteria: true } } } } },
    });
    const review = await db.review.create({
      data: {
        assignmentId: a.id,
        proofId: a.proofId,
        reviewerId: a.reviewerId,
        verdict: o.verdict,
        comment: o.comment ?? null,
        reviewMarks: {
          create: a.proof.criteriaVersion.criteria.map((c) => ({ criterionId: c.id, met: o.verdict === "pass" })),
        },
      },
    });
    await db.reviewAssignment.update({ where: { id: a.id }, data: { state: "done" } });
    return review;
  },
};
