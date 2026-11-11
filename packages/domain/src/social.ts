/**
 * Theo dõi, trao đổi kỹ năng, nhắn tin, thông báo.
 */
import type { SwapMode, SwapStatus } from "@skillverse/db";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { activeSanctionKinds, assertCanPost } from "./moderation";

async function activeUser(db: Db, id: string) {
  const u = await db.user.findFirst({ where: { id, deletedAt: null, status: { not: "banned" } }, select: { id: true } });
  if (!u) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
  return u;
}

// ---------------------------------------------------------------------------
// Theo dõi
// ---------------------------------------------------------------------------

export async function follow(
  db: Db,
  p: { followerId: string; followeeId: string; now?: Date },
): Promise<{ following: true; followerCount: number }> {
  const now = p.now ?? new Date();
  if (p.followerId === p.followeeId) throw new DomainError("BAD_REQUEST", "Không thể tự theo dõi mình.");
  return withTx(db, async (tx) => {
    await activeUser(tx, p.followeeId);
    const r = await tx.follow.createMany({
      data: [{ followerId: p.followerId, followeeId: p.followeeId, createdAt: now }],
      skipDuplicates: true,
    });
    if (r.count > 0) {
      await tx.notification.create({
        data: { userId: p.followeeId, kind: "new_follower", refType: "user", refId: p.followerId, createdAt: now },
      });
    }
    return { following: true, followerCount: await tx.follow.count({ where: { followeeId: p.followeeId } }) };
  });
}

export async function unfollow(
  db: Db,
  p: { followerId: string; followeeId: string },
): Promise<{ following: false; followerCount: number }> {
  await db.follow.deleteMany({ where: { followerId: p.followerId, followeeId: p.followeeId } });
  return { following: false, followerCount: await db.follow.count({ where: { followeeId: p.followeeId } }) };
}

// ---------------------------------------------------------------------------
// Trao đổi kỹ năng
// ---------------------------------------------------------------------------

export type SwapView = {
  id: string;
  status: SwapStatus;
  mode: SwapMode;
  scheduledAt: Date | null;
  createdAt: Date;
  /** Vai của người xem. */
  role: "proposer" | "receiver";
  other: { handle: string; displayName: string; avatarUrl: string | null };
  /** Kỹ năng người đề nghị dạy / muốn học. */
  teachSkill: { slug: string; name: string };
  learnSkill: { slug: string; name: string };
  myRating: number | null;
  canRate: boolean;
};

/**
 * Đề nghị trao đổi: người đề nghị dạy `teachSkillId` (đã đạt cấp ≥ 1) và học `learnSkillId`
 * từ người nhận (người nhận đạt cấp ≥ 1). Không có đề nghị đang mở giữa hai người.
 */
export async function proposeSwap(
  db: Db,
  p: { proposerId: string; receiverId: string; teachSkillId: string; learnSkillId: string; mode: SwapMode; now?: Date },
): Promise<{ swapId: string }> {
  const now = p.now ?? new Date();
  if (p.proposerId === p.receiverId) throw new DomainError("BAD_REQUEST", "Không thể tự trao đổi với mình.");
  return withTx(db, async (tx) => {
    await assertCanPost(tx, p.proposerId, now);
    await activeUser(tx, p.receiverId);
    const teach = await tx.userSkill.findUnique({
      where: { userId_skillId: { userId: p.proposerId, skillId: p.teachSkillId } },
      select: { level: true },
    });
    const learn = await tx.userSkill.findUnique({
      where: { userId_skillId: { userId: p.receiverId, skillId: p.learnSkillId } },
      select: { level: true },
    });
    if (!teach || teach.level < 1) throw new DomainError("PRECONDITION_FAILED", "Bạn cần đạt cấp 1 kỹ năng muốn dạy.");
    if (!learn || learn.level < 1) throw new DomainError("PRECONDITION_FAILED", "Người này chưa đạt kỹ năng bạn muốn học.");
    const open = await tx.skillSwap.count({
      where: {
        status: { in: ["proposed", "accepted"] },
        OR: [
          { proposerId: p.proposerId, receiverId: p.receiverId },
          { proposerId: p.receiverId, receiverId: p.proposerId },
        ],
      },
    });
    if (open > 0) throw new DomainError("CONFLICT", "Hai bạn đang có đề nghị trao đổi chưa xong.");
    const s = await tx.skillSwap.create({
      data: {
        proposerId: p.proposerId,
        receiverId: p.receiverId,
        teachSkillId: p.teachSkillId,
        learnSkillId: p.learnSkillId,
        mode: p.mode,
        createdAt: now,
      },
    });
    await tx.notification.create({ data: { userId: p.receiverId, kind: "swap_proposed", refType: "swap", refId: s.id, createdAt: now } });
    return { swapId: s.id };
  });
}

/**
 * accept / decline: chỉ người nhận, khi `proposed`. cancel: một trong hai, khi proposed/accepted.
 * complete: một trong hai, khi accepted → done (mở đánh giá).
 */
export async function respondSwap(
  db: Db,
  p: { swapId: string; userId: string; action: "accept" | "decline" | "cancel" | "complete"; scheduledAt?: Date | null; now?: Date },
): Promise<{ swapId: string; status: SwapStatus }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const s = await tx.skillSwap.findUnique({ where: { id: p.swapId } });
    if (!s) throw new DomainError("NOT_FOUND", "Không tìm thấy đề nghị trao đổi.");
    const isReceiver = s.receiverId === p.userId;
    const isMember = isReceiver || s.proposerId === p.userId;
    if (!isMember) throw new DomainError("FORBIDDEN", "Bạn không thuộc đề nghị này.");
    let status: SwapStatus;
    switch (p.action) {
      case "accept":
      case "decline":
        if (!isReceiver) throw new DomainError("FORBIDDEN", "Chỉ người nhận được trả lời.");
        if (s.status !== "proposed") throw new DomainError("CONFLICT", "Đề nghị đã được trả lời.");
        status = p.action === "accept" ? "accepted" : "cancelled";
        break;
      case "cancel":
        if (s.status !== "proposed" && s.status !== "accepted") throw new DomainError("CONFLICT", "Đề nghị đã đóng.");
        status = "cancelled";
        break;
      case "complete":
        if (s.status !== "accepted") throw new DomainError("PRECONDITION_FAILED", "Chỉ hoàn thành được đề nghị đã chấp nhận.");
        status = "done";
        break;
    }
    await tx.skillSwap.update({
      where: { id: s.id },
      data: { status, ...(p.action === "accept" && p.scheduledAt ? { scheduledAt: p.scheduledAt } : {}) },
    });
    const other = isReceiver ? s.proposerId : s.receiverId;
    await tx.notification.create({ data: { userId: other, kind: `swap_${status}`, refType: "swap", refId: s.id, createdAt: now } });
    return { swapId: s.id, status };
  });
}

/** Đánh giá 1–5 sao sau khi trao đổi xong; mỗi người một lần. */
export async function rateSwap(
  db: Db,
  p: { swapId: string; raterId: string; stars: number; comment?: string | null; now?: Date },
): Promise<{ rated: true }> {
  const now = p.now ?? new Date();
  if (!Number.isInteger(p.stars) || p.stars < 1 || p.stars > 5) throw new DomainError("BAD_REQUEST", "Số sao từ 1 đến 5.");
  return withTx(db, async (tx) => {
    const s = await tx.skillSwap.findUnique({ where: { id: p.swapId } });
    if (!s) throw new DomainError("NOT_FOUND", "Không tìm thấy đề nghị trao đổi.");
    if (s.proposerId !== p.raterId && s.receiverId !== p.raterId) throw new DomainError("FORBIDDEN", "Bạn không thuộc đề nghị này.");
    if (s.status !== "done") throw new DomainError("PRECONDITION_FAILED", "Chỉ đánh giá sau khi buổi trao đổi hoàn thành.");
    const r = await tx.swapRating.createMany({
      data: [{ swapId: s.id, raterId: p.raterId, stars: p.stars, comment: p.comment?.trim() || null, createdAt: now }],
      skipDuplicates: true,
    });
    if (r.count === 0) throw new DomainError("CONFLICT", "Bạn đã đánh giá buổi trao đổi này.");
    const other = s.proposerId === p.raterId ? s.receiverId : s.proposerId;
    await tx.notification.create({ data: { userId: other, kind: "swap_rated", refType: "swap", refId: s.id, createdAt: now } });
    return { rated: true };
  });
}

export async function listSwaps(db: Db, p: { userId: string; status?: SwapStatus[] }): Promise<SwapView[]> {
  const rows = await db.skillSwap.findMany({
    where: {
      OR: [{ proposerId: p.userId }, { receiverId: p.userId }],
      ...(p.status ? { status: { in: p.status } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      proposer: { select: { handle: true, displayName: true, avatarUrl: true } },
      receiver: { select: { handle: true, displayName: true, avatarUrl: true } },
      teachSkill: { select: { slug: true, name: true } },
      learnSkill: { select: { slug: true, name: true } },
      swapRatings: { where: { raterId: p.userId }, select: { stars: true } },
    },
  });
  return rows.map((s) => {
    const role = s.proposerId === p.userId ? ("proposer" as const) : ("receiver" as const);
    const myRating = s.swapRatings[0]?.stars ?? null;
    return {
      id: s.id,
      status: s.status,
      mode: s.mode,
      scheduledAt: s.status === "accepted" || s.status === "done" ? s.scheduledAt : null,
      createdAt: s.createdAt,
      role,
      other: role === "proposer" ? s.receiver : s.proposer,
      teachSkill: s.teachSkill,
      learnSkill: s.learnSkill,
      myRating,
      canRate: s.status === "done" && myRating === null,
    };
  });
}

// ---------------------------------------------------------------------------
// Nhắn tin
// ---------------------------------------------------------------------------

/** Thread giữa hai người (thứ tự user_a < user_b để không trùng). */
export async function getOrCreateThread(
  db: Db,
  p: { userId: string; otherUserId: string; now?: Date },
): Promise<{ threadId: string; created: boolean }> {
  if (p.userId === p.otherUserId) throw new DomainError("BAD_REQUEST", "Không thể nhắn cho chính mình.");
  const [a, b] = [p.userId, p.otherUserId].sort() as [string, string];
  return withTx(db, async (tx) => {
    await activeUser(tx, p.otherUserId);
    // Khóa theo cặp để hai yêu cầu đồng thời không tạo hai thread.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`thread:${a}:${b}`}))`;
    const existing = await tx.messageThread.findFirst({
      where: { OR: [{ userA: a, userB: b }, { userA: b, userB: a }] },
      select: { id: true },
    });
    if (existing) return { threadId: existing.id, created: false };
    const t = await tx.messageThread.create({ data: { userA: a, userB: b, createdAt: p.now ?? new Date() } });
    return { threadId: t.id, created: true };
  });
}

async function threadForMember(db: Db, threadId: string, userId: string) {
  const t = await db.messageThread.findUnique({ where: { id: threadId } });
  if (!t) throw new DomainError("NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
  if (t.userA !== userId && t.userB !== userId) throw new DomainError("FORBIDDEN", "Bạn không thuộc cuộc trò chuyện này.");
  return { ...t, otherId: t.userA === userId ? t.userB : t.userA };
}

export async function sendMessage(
  db: Db,
  p: { threadId: string; senderId: string; body: string; now?: Date },
): Promise<{ messageId: string; createdAt: Date }> {
  const now = p.now ?? new Date();
  const body = p.body.trim();
  if (!body) throw new DomainError("BAD_REQUEST", "Tin nhắn trống.");
  return withTx(db, async (tx) => {
    const t = await threadForMember(tx, p.threadId, p.senderId);
    await assertCanPost(tx, p.senderId, now);
    const m = await tx.message.create({ data: { threadId: t.id, senderId: p.senderId, body, createdAt: now } });
    await tx.notification.create({ data: { userId: t.otherId, kind: "message", refType: "thread", refId: t.id, createdAt: now } });
    return { messageId: m.id, createdAt: m.createdAt };
  });
}

export type ThreadSummary = {
  threadId: string;
  other: { handle: string; displayName: string; avatarUrl: string | null };
  lastMessage: { body: string; createdAt: Date; mine: boolean } | null;
  /** Số tin của người kia sau tin cuối cùng của mình (xấp xỉ "chưa đọc"). */
  unread: number;
};

export async function listThreads(db: Db, p: { userId: string }): Promise<ThreadSummary[]> {
  const threads = await db.messageThread.findMany({
    where: { OR: [{ userA: p.userId }, { userB: p.userId }] },
    include: {
      userAUser: { select: { handle: true, displayName: true, avatarUrl: true } },
      userBUser: { select: { handle: true, displayName: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 20, select: { body: true, createdAt: true, senderId: true } },
    },
  });
  return threads
    .map((t) => {
      const last = t.messages[0];
      const firstMine = t.messages.findIndex((m) => m.senderId === p.userId);
      return {
        threadId: t.id,
        other: t.userA === p.userId ? t.userBUser : t.userAUser,
        lastMessage: last ? { body: last.body, createdAt: last.createdAt, mine: last.senderId === p.userId } : null,
        unread: firstMine === -1 ? t.messages.length : firstMine,
        _sort: (last?.createdAt ?? t.createdAt).getTime(),
      };
    })
    .sort((x, y) => y._sort - x._sort)
    .map(({ _sort: _unused, ...rest }) => rest);
}

export async function listMessages(
  db: Db,
  p: { threadId: string; userId: string; cursor?: string | null; limit?: number },
): Promise<{
  other: { handle: string; displayName: string; avatarUrl: string | null };
  /** Người xem đang bị chặn gửi (post_ban/suspension). */
  canSend: boolean;
  items: { id: string; body: string; createdAt: Date; mine: boolean }[];
  /** Mới nhất trước; nextCursor để tải tin cũ hơn. */
  nextCursor: string | null;
}> {
  const t = await threadForMember(db, p.threadId, p.userId);
  const limit = p.limit ?? 30;
  const rows = await db.message.findMany({
    where: { threadId: t.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    select: { id: true, body: true, createdAt: true, senderId: true },
  });
  const page = rows.slice(0, limit);
  const other = await db.user.findUniqueOrThrow({
    where: { id: t.otherId },
    select: { handle: true, displayName: true, avatarUrl: true },
  });
  const kinds = await activeSanctionKinds(db, p.userId);
  return {
    other,
    canSend: !kinds.has("post_ban") && !kinds.has("suspension"),
    items: page.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, mine: m.senderId === p.userId })),
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// Thông báo
// ---------------------------------------------------------------------------

export type NotificationView = {
  id: string;
  kind: string;
  refType: string | null;
  refId: string | null;
  createdAt: Date;
  read: boolean;
};

export async function listNotifications(
  db: Db,
  p: { userId: string; cursor?: string | null; limit?: number },
): Promise<{ items: NotificationView[]; unreadCount: number; nextCursor: string | null }> {
  const limit = p.limit ?? 30;
  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: p.userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    }),
    db.notification.count({ where: { userId: p.userId, readAt: null } }),
  ]);
  const page = rows.slice(0, limit);
  return {
    items: page.map((n) => ({ id: n.id, kind: n.kind, refType: n.refType, refId: n.refId, createdAt: n.createdAt, read: n.readAt !== null })),
    unreadCount,
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/** Đánh dấu đã đọc (ids hoặc tất cả). */
export async function markNotificationsRead(
  db: Db,
  p: { userId: string; ids?: string[]; now?: Date },
): Promise<{ updated: number }> {
  const r = await db.notification.updateMany({
    where: { userId: p.userId, readAt: null, ...(p.ids ? { id: { in: p.ids } } : {}) },
    data: { readAt: p.now ?? new Date() },
  });
  return { updated: r.count };
}

/** Tra id người dùng còn hoạt động theo handle (cho router nhận handle). NOT_FOUND nếu không có. */
export async function userIdByHandle(db: Db, handle: string): Promise<string> {
  const u = await db.user.findFirst({ where: { handle, deletedAt: null, status: { not: "banned" } }, select: { id: true } });
  if (!u) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
  return u.id;
}
