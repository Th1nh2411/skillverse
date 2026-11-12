/**
 * Lưu (D74): người dùng lưu bài viết / kỹ năng / bằng chứng để xem lại. Chỉ chủ sở hữu đọc được danh sách của mình.
 * Đối tượng bị ẩn/xóa (bài bị ẩn, tác giả bị khóa, kỹ năng ngừng, bằng chứng bị gỡ) bị bỏ qua khi liệt kê.
 */
import type { Prisma } from "@skillverse/db";
import { getRarityThresholds } from "./config";
import type { Db } from "./db";
import { DomainError } from "./errors";
import { loadLevelTitles } from "./milestones";
import { rarityOf, type Rarity } from "./rarity";

export const SAVE_TARGET_TYPES = ["post", "skill", "proof"] as const;
export type SaveTargetType = (typeof SAVE_TARGET_TYPES)[number];

const activeUser = { deletedAt: null, status: { not: "banned" as const } };

function visiblePost(): Prisma.PostWhereInput {
  return { deletedAt: null, author: activeUser };
}
/** Bằng chứng xem được để lưu: đã đạt của tài khoản còn hoạt động, hoặc bằng chứng của chính mình (chưa bị xóa). */
function visibleProof(viewerId: string): Prisma.ProofWhereInput {
  return { deletedAt: null, OR: [{ status: "passed", user: activeUser }, { userId: viewerId }] };
}

async function assertVisible(db: Db, viewerId: string, type: SaveTargetType, id: string): Promise<void> {
  const n =
    type === "post"
      ? await db.post.count({ where: { id, ...visiblePost() } })
      : type === "skill"
        ? await db.skill.count({ where: { id, status: "active" } })
        : await db.proof.count({ where: { id, ...visibleProof(viewerId) } });
  if (n === 0) throw new DomainError("NOT_FOUND", "Không tìm thấy mục cần lưu.");
}

/** Đặt trạng thái lưu (idempotent). Bỏ lưu không cần đối tượng còn hiển thị. */
export async function setSaved(
  db: Db,
  p: { userId: string; targetType: SaveTargetType; targetId: string; saved: boolean; now?: Date },
): Promise<{ saved: boolean }> {
  const key = { userId: p.userId, targetType: p.targetType, targetId: p.targetId };
  if (!p.saved) {
    await db.save.deleteMany({ where: key });
    return { saved: false };
  }
  await assertVisible(db, p.userId, p.targetType, p.targetId);
  await db.save.createMany({ data: [{ ...key, createdAt: p.now ?? new Date() }], skipDuplicates: true });
  return { saved: true };
}

/** Bật/tắt lưu. */
export async function toggleSave(
  db: Db,
  p: { userId: string; targetType: SaveTargetType; targetId: string; now?: Date },
): Promise<{ saved: boolean }> {
  const exists = await db.save.count({ where: { userId: p.userId, targetType: p.targetType, targetId: p.targetId } });
  return setSaved(db, { ...p, saved: exists === 0 });
}

/** Tập id đã lưu của người xem trong `ids` (viewer null → rỗng). */
export async function savedIds(
  db: Db,
  viewerId: string | null | undefined,
  targetType: SaveTargetType,
  ids: string[],
): Promise<Set<string>> {
  if (!viewerId || ids.length === 0) return new Set();
  const rows = await db.save.findMany({
    where: { userId: viewerId, targetType, targetId: { in: [...new Set(ids)] } },
    select: { targetId: true },
  });
  return new Set(rows.map((r) => r.targetId));
}

export async function isSaved(db: Db, viewerId: string | null | undefined, targetType: SaveTargetType, id: string): Promise<boolean> {
  return (await savedIds(db, viewerId, targetType, [id])).has(id);
}

// ---------------------------------------------------------------------------
// Danh sách đã lưu
// ---------------------------------------------------------------------------

type SkillBrief = { slug: string; name: string; category: { slug: string; name: string }; rarity: Rarity };

export type SavedPost = {
  id: string;
  kind: string;
  body: string | null;
  createdAt: Date;
  author: { handle: string; displayName: string; avatarUrl: string | null };
  skill: SkillBrief | null;
  /** Bài lên cấp: bằng chứng + mốc. */
  levelUp: { proofId: string; level: number; levelTitle: string | null } | null;
};
export type SavedSkill = SkillBrief & { id: string; description: string | null; maxLevel: number };
export type SavedProof = {
  proofId: string;
  status: string;
  isMine: boolean;
  /** Chỉ tên hiển thị của người nộp (giống thẻ chia sẻ) — không handle/id. */
  displayName: string;
  skill: SkillBrief;
  level: number;
  levelTitle: string | null;
};

export type SavedItem =
  | { targetType: "post"; targetId: string; savedAt: Date; post: SavedPost }
  | { targetType: "skill"; targetId: string; savedAt: Date; skill: SavedSkill }
  | { targetType: "proof"; targetId: string; savedAt: Date; proof: SavedProof };

type Cursor = { t: string; ty: string; id: string };

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(s: string | null | undefined): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString()) as Cursor;
    if (typeof c.t === "string" && typeof c.ty === "string" && typeof c.id === "string" && !Number.isNaN(Date.parse(c.t))) return c;
  } catch {
    // bỏ qua
  }
  throw new DomainError("BAD_REQUEST", "Con trỏ phân trang không hợp lệ.");
}

const skillBriefSelect = { slug: true, name: true, holderCount: true, category: { select: { slug: true, name: true } } } as const;

/** Mục đã lưu của chính người dùng, mới nhất trước. Mục không còn hiển thị bị bỏ qua (trang có thể ít hơn limit). */
export async function listSaved(
  db: Db,
  p: { userId: string; cursor?: string | null; limit?: number },
): Promise<{ items: SavedItem[]; nextCursor: string | null }> {
  const limit = p.limit ?? 20;
  const c = decodeCursor(p.cursor);
  const rows = await db.save.findMany({
    where: {
      userId: p.userId,
      ...(c
        ? {
            OR: [
              { createdAt: { lt: new Date(c.t) } },
              { createdAt: new Date(c.t), targetType: { gt: c.ty } },
              { createdAt: new Date(c.t), targetType: c.ty, targetId: { gt: c.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { targetType: "asc" }, { targetId: "asc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last ? encodeCursor({ t: last.createdAt.toISOString(), ty: last.targetType, id: last.targetId }) : null;

  const ids = (t: SaveTargetType) => page.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [posts, skills, proofs, thresholds] = await Promise.all([
    ids("post").length
      ? db.post.findMany({
          where: { id: { in: ids("post") }, ...visiblePost() },
          select: {
            id: true,
            kind: true,
            body: true,
            createdAt: true,
            skillId: true,
            proofId: true,
            author: { select: { handle: true, displayName: true, avatarUrl: true } },
            skill: { select: skillBriefSelect },
            proof: { select: { targetLevel: true } },
          },
        })
      : [],
    ids("skill").length
      ? db.skill.findMany({
          where: { id: { in: ids("skill") }, status: "active" },
          select: { id: true, description: true, maxLevel: true, ...skillBriefSelect },
        })
      : [],
    ids("proof").length
      ? db.proof.findMany({
          where: { id: { in: ids("proof") }, ...visibleProof(p.userId) },
          select: {
            id: true,
            status: true,
            userId: true,
            skillId: true,
            targetLevel: true,
            user: { select: { displayName: true } },
            skill: { select: skillBriefSelect },
          },
        })
      : [],
    getRarityThresholds(db),
  ]);
  const titleOf = await loadLevelTitles(db, [
    ...posts.flatMap((x) => (x.skillId ? [x.skillId] : [])),
    ...proofs.map((x) => x.skillId),
  ]);
  const brief = (s: { slug: string; name: string; holderCount: number; category: { slug: string; name: string } }): SkillBrief => ({
    slug: s.slug,
    name: s.name,
    category: s.category,
    rarity: rarityOf(s.holderCount, thresholds),
  });
  const postById = new Map(posts.map((x) => [x.id, x]));
  const skillById = new Map(skills.map((x) => [x.id, x]));
  const proofById = new Map(proofs.map((x) => [x.id, x]));

  const items: SavedItem[] = page.flatMap((r): SavedItem[] => {
    if (r.targetType === "post") {
      const x = postById.get(r.targetId);
      if (!x) return [];
      return [
        {
          targetType: "post",
          targetId: r.targetId,
          savedAt: r.createdAt,
          post: {
            id: x.id,
            kind: x.kind,
            body: x.body,
            createdAt: x.createdAt,
            author: x.author,
            skill: x.skill ? brief(x.skill) : null,
            levelUp:
              x.kind === "level_up" && x.proofId && x.proof
                ? { proofId: x.proofId, level: x.proof.targetLevel, levelTitle: x.skillId ? titleOf(x.skillId, x.proof.targetLevel) : null }
                : null,
          },
        },
      ];
    }
    if (r.targetType === "skill") {
      const x = skillById.get(r.targetId);
      if (!x) return [];
      return [
        {
          targetType: "skill",
          targetId: r.targetId,
          savedAt: r.createdAt,
          skill: { id: x.id, description: x.description, maxLevel: x.maxLevel, ...brief(x) },
        },
      ];
    }
    const x = proofById.get(r.targetId);
    if (!x) return [];
    return [
      {
        targetType: "proof",
        targetId: r.targetId,
        savedAt: r.createdAt,
        proof: {
          proofId: x.id,
          status: x.status,
          isMine: x.userId === p.userId,
          displayName: x.user.displayName,
          skill: brief(x.skill),
          level: x.targetLevel,
          levelTitle: titleOf(x.skillId, x.targetLevel),
        },
      },
    ];
  });
  return { items, nextCursor };
}
