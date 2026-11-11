/**
 * Thử thách tuần, bằng chứng chờ duyệt (ẩn danh) cho cộng đồng, đấu 1v1.
 */
import { getConfig, getRarityThresholds } from "./config";
import { rarityOf, type Rarity } from "./rarity";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { awardXp } from "./ledger";
import { anonymousCode } from "./reviews";

// ---------------------------------------------------------------------------
// Thử thách
// ---------------------------------------------------------------------------

export type ChallengeView = {
  id: string;
  title: string;
  description: string | null;
  items: string[];
  skill: { id: string; slug: string; name: string };
  startsAt: Date;
  endsAt: Date;
  xpReward: number;
  participantCount: number;
  joined: boolean;
};

function parseChallengeCriteria(c: unknown): { description: string | null; items: string[] } {
  const o = (c && typeof c === "object" ? c : {}) as { description?: unknown; items?: unknown };
  return {
    description: typeof o.description === "string" ? o.description : null,
    items: Array.isArray(o.items) ? o.items.filter((x): x is string => typeof x === "string") : [],
  };
}

/** Thử thách đang diễn ra (starts_at ≤ now < ends_at), sắp kết thúc trước. */
export async function getActiveChallenges(db: Db, p: { userId?: string | null; now?: Date } = {}): Promise<ChallengeView[]> {
  const now = p.now ?? new Date();
  const rows = await db.challenge.findMany({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { endsAt: "asc" },
    include: {
      skill: { select: { id: true, slug: true, name: true } },
      _count: { select: { challengeEntries: true } },
      ...(p.userId ? { challengeEntries: { where: { userId: p.userId }, select: { userId: true } } } : {}),
    },
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    ...parseChallengeCriteria(c.criteria),
    skill: c.skill,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    xpReward: c.xpReward,
    participantCount: c._count.challengeEntries,
    joined: "challengeEntries" in c && Array.isArray(c.challengeEntries) && c.challengeEntries.length > 0,
  }));
}

/** Tham gia thử thách bằng một bằng chứng của chính mình, đúng kỹ năng, nộp trong thời gian thử thách. */
export async function joinChallenge(
  db: Db,
  p: { challengeId: string; userId: string; proofId: string; now?: Date },
): Promise<{ joined: true }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const c = await tx.challenge.findUnique({ where: { id: p.challengeId } });
    if (!c) throw new DomainError("NOT_FOUND", "Không tìm thấy thử thách.");
    if (now < c.startsAt || now >= c.endsAt) throw new DomainError("PRECONDITION_FAILED", "Thử thách không còn diễn ra.");
    const proof = await tx.proof.findFirst({ where: { id: p.proofId, deletedAt: null } });
    if (!proof || proof.userId !== p.userId) throw new DomainError("FORBIDDEN", "Chỉ dùng được bằng chứng của bạn.");
    if (proof.skillId !== c.skillId) throw new DomainError("BAD_REQUEST", "Bằng chứng không thuộc kỹ năng của thử thách.");
    if (proof.status === "removed" || proof.status === "failed") throw new DomainError("BAD_REQUEST", "Bằng chứng không hợp lệ.");
    if (proof.createdAt < c.startsAt) throw new DomainError("BAD_REQUEST", "Bằng chứng phải nộp trong thời gian thử thách.");
    const r = await tx.challengeEntry.createMany({
      data: [{ challengeId: c.id, userId: p.userId, proofId: proof.id }],
      skipDuplicates: true,
    });
    if (r.count === 0) throw new DomainError("CONFLICT", "Bạn đã tham gia thử thách này.");
    return { joined: true };
  });
}

// ---------------------------------------------------------------------------
// Bằng chứng chờ duyệt (cộng đồng, ẩn danh)
// ---------------------------------------------------------------------------

export type CommunityPendingProof = {
  anonymousCode: string;
  skill: { slug: string; name: string; category: { slug: string; name: string }; rarity: Rarity };
  targetLevel: number;
  durationS: number | null;
  caption: string | null;
  submittedAt: Date;
  votes: number;
  required: number;
  /** Lượt duyệt của người xem trên bằng chứng này (nếu được phân công và còn chấm được) — để mở màn duyệt. */
  myAssignmentId: string | null;
  isMine: boolean;
};

/** Bằng chứng đang duyệt, ẩn danh người nộp (không id / handle / tên / proofId). */
export async function getPendingProofsForCommunity(
  db: Db,
  p: { viewerId?: string | null; limit?: number; now?: Date } = {},
): Promise<{ total: number; items: CommunityPendingProof[] }> {
  const now = p.now ?? new Date();
  const where = { status: "in_review" as const, deletedAt: null };
  const [total, rows] = await Promise.all([
    db.proof.count({ where }),
    db.proof.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: p.limit ?? 20,
      select: {
        id: true,
        userId: true,
        skillId: true,
        targetLevel: true,
        durationS: true,
        caption: true,
        createdAt: true,
        skill: { select: { slug: true, name: true, holderCount: true, category: { select: { slug: true, name: true } } } },
        reviewAssignments: { select: { id: true, reviewerId: true, state: true, dueAt: true } },
      },
    }),
  ]);
  const levels = rows.length
    ? await db.skillLevel.findMany({
        where: { OR: rows.map((r) => ({ skillId: r.skillId, level: r.targetLevel })) },
        select: { skillId: true, level: true, minReviewers: true },
      })
    : [];
  const thresholds = await getRarityThresholds(db);
  return {
    total,
    items: rows.map((r) => {
      const mine = p.viewerId
        ? r.reviewAssignments.find((a) => a.reviewerId === p.viewerId && a.state === "assigned" && a.dueAt >= now)
        : undefined;
      return {
        anonymousCode: anonymousCode(r.id),
        skill: { slug: r.skill.slug, name: r.skill.name, category: r.skill.category, rarity: rarityOf(r.skill.holderCount, thresholds) },
        targetLevel: r.targetLevel,
        durationS: r.durationS,
        caption: r.caption,
        submittedAt: r.createdAt,
        votes: r.reviewAssignments.filter((a) => a.state === "done").length,
        required: levels.find((l) => l.skillId === r.skillId && l.level === r.targetLevel)?.minReviewers ?? 0,
        myAssignmentId: mine?.id ?? null,
        isMine: !!p.viewerId && r.userId === p.viewerId,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Đấu 1v1
// ---------------------------------------------------------------------------

export type DuelView = {
  id: string;
  skill: { slug: string; name: string };
  metric: string;
  voteEndsAt: Date;
  closed: boolean;
  sides: {
    userId: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    caption: string | null;
    /** Khóa video (api ký URL; bằng chứng đấu đã/đang công khai cho người bỏ phiếu). */
    mediaKey: string | null;
    votes: number;
  }[];
  winnerId: string | null;
  myVote: string | null;
  canVote: boolean;
};

const duelInclude = {
  skill: { select: { slug: true, name: true } },
  userAUser: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
  userBUser: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
  proofAProof: { select: { caption: true, mediaUrl: true } },
  proofBProof: { select: { caption: true, mediaUrl: true } },
  duelVotes: { select: { userId: true, choice: true } },
} as const;

async function loadDuelViews(db: Db, where: Parameters<Db["duel"]["findMany"]>[0], viewerId: string | null | undefined, now: Date) {
  const rows = await db.duel.findMany({ ...where, include: duelInclude });
  return rows.map((d): DuelView => {
    const closed = d.voteEndsAt <= now;
    const isParticipant = viewerId === d.userA || viewerId === d.userB;
    const myVote = viewerId ? (d.duelVotes.find((v) => v.userId === viewerId)?.choice ?? null) : null;
    const side = (u: typeof d.userAUser, pr: typeof d.proofAProof) => ({
      userId: u.id,
      handle: u.handle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      caption: pr?.caption ?? null,
      mediaKey: pr?.mediaUrl ?? null,
      votes: d.duelVotes.filter((v) => v.choice === u.id).length,
    });
    return {
      id: d.id,
      skill: d.skill,
      metric: d.metric,
      voteEndsAt: d.voteEndsAt,
      closed,
      sides: [side(d.userAUser, d.proofAProof), side(d.userBUser, d.proofBProof)],
      winnerId: d.winnerId,
      myVote,
      canVote: !!viewerId && !closed && !isParticipant && !myVote,
    };
  });
}

export async function listDuels(
  db: Db,
  p: { viewerId?: string | null; now?: Date; includeClosed?: boolean; limit?: number } = {},
): Promise<DuelView[]> {
  const now = p.now ?? new Date();
  return loadDuelViews(
    db,
    {
      where: p.includeClosed ? {} : { voteEndsAt: { gt: now } },
      orderBy: { voteEndsAt: "asc" },
      take: p.limit ?? 20,
    },
    p.viewerId,
    now,
  );
}

export async function getDuel(db: Db, p: { duelId: string; viewerId?: string | null; now?: Date }): Promise<DuelView> {
  const [d] = await loadDuelViews(db, { where: { id: p.duelId } }, p.viewerId, p.now ?? new Date());
  if (!d) throw new DomainError("NOT_FOUND", "Không tìm thấy trận đấu.");
  return d;
}

/** Tạo trận đấu. Người tạo là một trong hai người đấu hoặc biên tập viên; bằng chứng (nếu có) đúng người, đúng kỹ năng. */
export async function createDuel(
  db: Db,
  p: {
    creatorId: string;
    skillId: string;
    metric: string;
    userA: string;
    userB: string;
    proofA?: string | null;
    proofB?: string | null;
    voteEndsAt: Date;
    now?: Date;
  },
): Promise<{ duelId: string }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    if (p.userA === p.userB) throw new DomainError("BAD_REQUEST", "Hai người đấu phải khác nhau.");
    if (p.voteEndsAt <= now) throw new DomainError("BAD_REQUEST", "Hạn bỏ phiếu phải ở tương lai.");
    if (!p.metric.trim()) throw new DomainError("BAD_REQUEST", "Cần nêu tiêu chí so tài.");
    const creator = await tx.user.findUnique({ where: { id: p.creatorId }, select: { isEditor: true } });
    if (!creator) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
    if (!creator.isEditor && p.creatorId !== p.userA && p.creatorId !== p.userB) {
      throw new DomainError("FORBIDDEN", "Chỉ người tham gia hoặc biên tập viên được tạo trận đấu.");
    }
    const skill = await tx.skill.findFirst({ where: { id: p.skillId, status: "active" }, select: { id: true } });
    if (!skill) throw new DomainError("NOT_FOUND", "Không tìm thấy kỹ năng.");
    const users = await tx.user.count({ where: { id: { in: [p.userA, p.userB] }, deletedAt: null, status: "active" } });
    if (users !== 2) throw new DomainError("BAD_REQUEST", "Người đấu không hợp lệ.");
    for (const [proofId, owner] of [
      [p.proofA, p.userA],
      [p.proofB, p.userB],
    ] as const) {
      if (!proofId) continue;
      const pr = await tx.proof.findFirst({ where: { id: proofId, deletedAt: null }, select: { userId: true, skillId: true, status: true } });
      if (!pr || pr.userId !== owner || pr.skillId !== p.skillId || pr.status === "removed") {
        throw new DomainError("BAD_REQUEST", "Bằng chứng đấu không hợp lệ.");
      }
    }
    const d = await tx.duel.create({
      data: {
        skillId: p.skillId,
        metric: p.metric.trim(),
        userA: p.userA,
        userB: p.userB,
        proofA: p.proofA ?? null,
        proofB: p.proofB ?? null,
        voteEndsAt: p.voteEndsAt,
        createdAt: now,
      },
    });
    for (const uid of [p.userA, p.userB].filter((u) => u !== p.creatorId)) {
      await tx.notification.create({ data: { userId: uid, kind: "duel_created", refType: "duel", refId: d.id, createdAt: now } });
    }
    return { duelId: d.id };
  });
}

/** Một phiếu mỗi người, người đấu không bầu được, trước vote_ends_at. */
export async function voteDuel(
  db: Db,
  p: { duelId: string; userId: string; choice: string; now?: Date },
): Promise<{ votesA: number; votesB: number }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const d = await tx.duel.findUnique({ where: { id: p.duelId } });
    if (!d) throw new DomainError("NOT_FOUND", "Không tìm thấy trận đấu.");
    if (d.voteEndsAt <= now || d.winnerId) throw new DomainError("PRECONDITION_FAILED", "Đã hết thời gian bỏ phiếu.");
    if (p.userId === d.userA || p.userId === d.userB) throw new DomainError("FORBIDDEN", "Người đấu không được bỏ phiếu.");
    if (p.choice !== d.userA && p.choice !== d.userB) throw new DomainError("BAD_REQUEST", "Lựa chọn không hợp lệ.");
    const r = await tx.duelVote.createMany({
      data: [{ duelId: d.id, userId: p.userId, choice: p.choice, createdAt: now }],
      skipDuplicates: true,
    });
    if (r.count === 0) throw new DomainError("CONFLICT", "Bạn đã bỏ phiếu trận này.");
    const votesA = await tx.duelVote.count({ where: { duelId: d.id, choice: d.userA } });
    const votesB = await tx.duelVote.count({ where: { duelId: d.id, choice: d.userB } });
    return { votesA, votesB };
  });
}

/**
 * Cron: chốt trận đã hết hạn bỏ phiếu và chưa có người thắng. Nhiều phiếu hơn thắng, nhận XP
 * `xp_rewards.duel_won` (challenge_won) — thiếu khóa thì 0 XP. Hòa → không ai thắng, chỉ thông báo một lần.
 * Idempotent: chỉ xử lý trận winner_id IS NULL và chưa thông báo kết thúc.
 */
export async function closeDuels(db: Db, p: { now?: Date } = {}): Promise<{ closed: number; winners: number }> {
  const now = p.now ?? new Date();
  const due = await db.duel.findMany({ where: { voteEndsAt: { lte: now }, winnerId: null }, select: { id: true } });
  let closed = 0;
  let winners = 0;
  for (const { id } of due) {
    await withTx(db, async (tx) => {
      await tx.$queryRaw`SELECT id FROM duels WHERE id = ${id}::uuid FOR UPDATE`;
      const d = await tx.duel.findUniqueOrThrow({ where: { id } });
      if (d.winnerId) return;
      const ended = await tx.notification.count({ where: { refType: "duel", refId: id, kind: { in: ["duel_won", "duel_lost", "duel_tied"] } } });
      if (ended > 0) return; // hòa đã xử lý ở lần chạy trước
      const a = await tx.duelVote.count({ where: { duelId: id, choice: d.userA } });
      const b = await tx.duelVote.count({ where: { duelId: id, choice: d.userB } });
      closed += 1;
      if (a === b) {
        await tx.notification.createMany({
          data: [d.userA, d.userB].map((userId) => ({ userId, kind: "duel_tied", refType: "duel", refId: id, createdAt: now })),
        });
        return;
      }
      const winner = a > b ? d.userA : d.userB;
      const loser = a > b ? d.userB : d.userA;
      await tx.duel.update({ where: { id }, data: { winnerId: winner } });
      const rewards = await getConfig<{ duel_won?: number }>(tx, "xp_rewards");
      const xp = rewards.duel_won ?? 0;
      if (xp > 0) {
        await awardXp(tx, { userId: winner, amount: xp, reason: "challenge_won", skillId: d.skillId, refType: "duel", refId: id, now });
      }
      await tx.notification.createMany({
        data: [
          { userId: winner, kind: "duel_won", refType: "duel", refId: id, createdAt: now },
          { userId: loser, kind: "duel_lost", refType: "duel", refId: id, createdAt: now },
        ],
      });
      winners += 1;
    });
  }
  return { closed, winners };
}
