/**
 * Feed trang chủ, cảm xúc, bình luận, bài viết.
 */
import type { PostKind, Prisma } from "@skillverse/db";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { getRarityThresholds, type RarityThresholds } from "./config";
import { loadLevelTitles, type LevelTitleLookup } from "./milestones";
import { assertCanPost } from "./moderation";
import { rarityOf, type Rarity } from "./rarity";

export const REACTION_KINDS = ["like", "cheer"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export type FeedItem = {
  id: string;
  kind: PostKind;
  body: string | null;
  mediaUrl: string | null;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  author: { handle: string; displayName: string; avatarUrl: string | null; accountLevel: number };
  /** category + rarity để vẽ huy hiệu vải (hình theo danh mục, chỉ thêu theo độ hiếm). */
  skill: { slug: string; name: string; category: { slug: string; name: string }; rarity: Rarity } | null;
  /** Bài lên cấp: cấp đạt + số người duyệt đạt / tổng phiếu ("3/3 người duyệt"). proofId để mở thẻ chia sẻ. */
  levelUp: { proofId: string; level: number; levelTitle: string | null; passVotes: number; totalVotes: number } | null;
  myReactions: ReactionKind[];
  /** true khi bài đến từ người / kỹ năng đang theo dõi (hoặc của chính mình). */
  followed: boolean;
};

type Cursor = { ph: "f"; t: string; id: string } | { ph: "p"; o: number };

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(s: string | null | undefined): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString()) as Cursor;
    if (c.ph === "f" && typeof c.t === "string" && typeof c.id === "string") return c;
    if (c.ph === "p" && Number.isInteger(c.o) && c.o >= 0) return c;
  } catch {
    // bỏ qua
  }
  throw new DomainError("BAD_REQUEST", "Con trỏ phân trang không hợp lệ.");
}

const postSelect = {
  id: true,
  kind: true,
  body: true,
  mediaUrl: true,
  createdAt: true,
  likeCount: true,
  commentCount: true,
  authorId: true,
  skillId: true,
  proofId: true,
  author: { select: { handle: true, displayName: true, avatarUrl: true, accountLevel: true } },
  skill: { select: { slug: true, name: true, holderCount: true, category: { select: { slug: true, name: true } } } },
  proof: {
    select: {
      targetLevel: true,
      status: true,
      reviews: { where: { assignment: { state: "done" } }, select: { verdict: true } },
    },
  },
} satisfies Prisma.PostSelect;

type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

const visible: Prisma.PostWhereInput = {
  deletedAt: null,
  author: { deletedAt: null, status: { not: "banned" } },
};

/**
 * Feed trang chủ: trước hết bài của chính mình / người đang theo dõi / kỹ năng đang theo dõi (mới nhất trước),
 * hết thì tới bài phổ biến còn lại (like_count giảm dần). `cursor` mờ, trả về trong `nextCursor`.
 */
export async function getHomeFeed(
  db: Db,
  p: { userId: string; cursor?: string | null; limit?: number },
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const limit = p.limit ?? 20;
  const cursor = decodeCursor(p.cursor);
  const [followees, skills] = await Promise.all([
    db.follow.findMany({ where: { followerId: p.userId }, select: { followeeId: true } }),
    db.skillFollow.findMany({ where: { userId: p.userId }, select: { skillId: true } }),
  ]);
  const authorIds = [p.userId, ...followees.map((f) => f.followeeId)];
  const skillIds = skills.map((s) => s.skillId);
  const followedWhere: Prisma.PostWhereInput = {
    ...visible,
    OR: [{ authorId: { in: authorIds } }, ...(skillIds.length ? [{ skillId: { in: skillIds } }] : [])],
  };
  const popularWhere: Prisma.PostWhereInput = {
    ...visible,
    authorId: { notIn: authorIds },
    OR: [{ skillId: null }, { skillId: { notIn: skillIds } }],
  };

  const rows: { row: PostRow; followed: boolean }[] = [];
  let next: Cursor | null = null;

  if (!cursor || cursor.ph === "f") {
    const f = await db.post.findMany({
      where: cursor
        ? {
            AND: [
              followedWhere,
              {
                OR: [
                  { createdAt: { lt: new Date(cursor.t) } },
                  { createdAt: new Date(cursor.t), id: { lt: cursor.id } },
                ],
              },
            ],
          }
        : followedWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: postSelect,
    });
    for (const r of f.slice(0, limit)) rows.push({ row: r, followed: true });
    if (f.length > limit) {
      const last = f[limit - 1]!;
      next = { ph: "f", t: last.createdAt.toISOString(), id: last.id };
    }
  }
  if (!next && rows.length < limit) {
    const offset = cursor?.ph === "p" ? cursor.o : 0;
    const need = limit - rows.length;
    const pp = await db.post.findMany({
      where: popularWhere,
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: need + 1,
      select: postSelect,
    });
    for (const r of pp.slice(0, need)) rows.push({ row: r, followed: false });
    if (pp.length > need) next = { ph: "p", o: offset + need };
  }

  const reactions = rows.length
    ? await db.reaction.findMany({
        where: { userId: p.userId, postId: { in: rows.map((r) => r.row.id) } },
        select: { postId: true, kind: true },
      })
    : [];

  const thresholds = await getRarityThresholds(db);
  const titleOf = await loadLevelTitles(
    db,
    rows.flatMap(({ row }) => (row.kind === "level_up" && row.skillId ? [row.skillId] : [])),
  );
  return {
    items: rows.map(({ row, followed }) => toFeedItem(row, followed, reactions, thresholds, titleOf)),
    nextCursor: next ? encodeCursor(next) : null,
  };
}

function toFeedItem(
  row: PostRow,
  followed: boolean,
  reactions: { postId: string; kind: string }[],
  thresholds: RarityThresholds,
  titleOf: LevelTitleLookup,
): FeedItem {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    mediaUrl: row.mediaUrl,
    createdAt: row.createdAt,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    author: row.author,
    skill: row.skill
      ? {
          slug: row.skill.slug,
          name: row.skill.name,
          category: row.skill.category,
          rarity: rarityOf(row.skill.holderCount, thresholds),
        }
      : null,
    levelUp:
      row.kind === "level_up" && row.proof && row.proofId
        ? {
            proofId: row.proofId,
            level: row.proof.targetLevel,
            levelTitle: row.skillId ? titleOf(row.skillId, row.proof.targetLevel) : null,
            passVotes: row.proof.reviews.filter((v) => v.verdict === "pass").length,
            totalVotes: row.proof.reviews.length,
          }
        : null,
    myReactions: reactions
      .filter((r) => r.postId === row.id && (REACTION_KINDS as readonly string[]).includes(r.kind))
      .map((r) => r.kind as ReactionKind),
    followed,
  };
}

/** Bật/tắt cảm xúc (idempotent theo `on`). like_count = tổng cảm xúc, cập nhật cùng transaction. */
export async function reactToPost(
  db: Db,
  p: { postId: string; userId: string; kind: ReactionKind; on: boolean; now?: Date },
): Promise<{ likeCount: number; myReactions: ReactionKind[] }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM posts WHERE id = ${p.postId}::uuid FOR NO KEY UPDATE`;
    const post = await tx.post.findFirst({ where: { id: p.postId, ...visible }, select: { id: true, authorId: true } });
    if (!post) throw new DomainError("NOT_FOUND", "Không tìm thấy bài viết.");
    if (p.on) {
      const r = await tx.reaction.createMany({
        data: [{ postId: post.id, userId: p.userId, kind: p.kind, createdAt: now }],
        skipDuplicates: true,
      });
      if (r.count > 0 && post.authorId !== p.userId) {
        await tx.notification.create({
          data: { userId: post.authorId, kind: "post_reaction", refType: "post", refId: post.id, createdAt: now },
        });
      }
    } else {
      await tx.reaction.deleteMany({ where: { postId: post.id, userId: p.userId, kind: p.kind } });
    }
    const likeCount = await tx.reaction.count({ where: { postId: post.id } });
    await tx.post.update({ where: { id: post.id }, data: { likeCount } });
    const mine = await tx.reaction.findMany({ where: { postId: post.id, userId: p.userId }, select: { kind: true } });
    return { likeCount, myReactions: mine.map((m) => m.kind as ReactionKind) };
  });
}

export async function commentOnPost(
  db: Db,
  p: { postId: string; userId: string; body: string; now?: Date },
): Promise<{ commentId: string; commentCount: number }> {
  const now = p.now ?? new Date();
  const body = p.body.trim();
  if (!body) throw new DomainError("BAD_REQUEST", "Bình luận trống.");
  return withTx(db, async (tx) => {
    await assertCanPost(tx, p.userId, now);
    await tx.$queryRaw`SELECT id FROM posts WHERE id = ${p.postId}::uuid FOR NO KEY UPDATE`;
    const post = await tx.post.findFirst({ where: { id: p.postId, ...visible }, select: { id: true, authorId: true } });
    if (!post) throw new DomainError("NOT_FOUND", "Không tìm thấy bài viết.");
    const c = await tx.comment.create({ data: { postId: post.id, userId: p.userId, body, createdAt: now } });
    const commentCount = await tx.comment.count({ where: { postId: post.id, deletedAt: null } });
    await tx.post.update({ where: { id: post.id }, data: { commentCount } });
    if (post.authorId !== p.userId) {
      await tx.notification.create({
        data: { userId: post.authorId, kind: "post_comment", refType: "post", refId: post.id, createdAt: now },
      });
    }
    return { commentId: c.id, commentCount };
  });
}

export async function listComments(
  db: Db,
  p: { postId: string; cursor?: string | null; limit?: number },
): Promise<{
  items: { id: string; body: string; createdAt: Date; author: { handle: string; displayName: string; avatarUrl: string | null } }[];
  nextCursor: string | null;
}> {
  const limit = p.limit ?? 30;
  const rows = await db.comment.findMany({
    where: { postId: p.postId, deletedAt: null, user: { deletedAt: null, status: { not: "banned" } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    select: { id: true, body: true, createdAt: true, user: { select: { handle: true, displayName: true, avatarUrl: true } } },
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt, author: r.user })),
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export async function createTextPost(
  db: Db,
  p: { userId: string; body: string; skillId?: string | null; now?: Date },
): Promise<{ postId: string }> {
  const now = p.now ?? new Date();
  const body = p.body.trim();
  if (!body) throw new DomainError("BAD_REQUEST", "Nội dung trống.");
  return withTx(db, async (tx) => {
    await assertCanPost(tx, p.userId, now);
    if (p.skillId) {
      const s = await tx.skill.findFirst({ where: { id: p.skillId, status: "active" }, select: { id: true } });
      if (!s) throw new DomainError("BAD_REQUEST", "Kỹ năng không hợp lệ.");
    }
    const post = await tx.post.create({
      data: { authorId: p.userId, kind: "text", body, skillId: p.skillId ?? null, createdAt: now },
    });
    return { postId: post.id };
  });
}
