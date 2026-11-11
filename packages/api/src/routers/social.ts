/** Giai đoạn 3: trang chủ (nhiệm vụ ngày, feed), bài đăng, thử thách/đấu, xã hội, nhắn tin, thông báo, báo cáo. */
import {
  commentOnPost,
  createReport,
  createTextPost,
  follow,
  getActiveChallenges,
  getDailyQuests,
  getDuel,
  getHomeFeed,
  getOrCreateThread,
  getPendingProofsForCommunity,
  joinChallenge,
  listComments,
  listDuels,
  listMessages,
  listNotifications,
  listSwaps,
  listThreads,
  markNotificationsRead,
  progressQuest,
  proposeSwap,
  rateSwap,
  reactToPost,
  respondSwap,
  sendMessage,
  unfollow,
  userIdByHandle,
  voteDuel,
  type DuelView,
} from "@skillverse/domain";
import {
  createReportInput,
  createTextPostInput,
  duelIdInput,
  duelVoteInput,
  feedInput,
  followInput,
  joinChallengeInput,
  markNotificationsReadInput,
  notificationsInput,
  openThreadInput,
  postCommentInput,
  postCommentsInput,
  postReactInput,
  proposeSwapInput,
  questProgressInput,
  rateSwapInput,
  respondSwapInput,
  sendMessageInput,
  threadMessagesInput,
} from "@skillverse/validation";
import { VIEW_URL_TTL_S } from "../media";
import type { Storage } from "../storage";
import { protectedProcedure, router } from "../trpc";

/** Thay khóa object của video trong trận đấu bằng URL ký có thời hạn. */
async function signDuel(storage: Storage, d: DuelView) {
  const sides = await Promise.all(
    d.sides.map(async ({ mediaKey, ...s }) => ({
      ...s,
      video: mediaKey
        ? { url: await storage.presignGet(mediaKey, VIEW_URL_TTL_S), expiresAt: new Date(Date.now() + VIEW_URL_TTL_S * 1000) }
        : null,
    })),
  );
  return { ...d, sides };
}

export const homeRouter = router({
  /** Nhiệm vụ ngày + chuỗi ngày. */
  quests: protectedProcedure.query(({ ctx }) => getDailyQuests(ctx.db, { userId: ctx.user.id })),
  /** Ghi nhận tiến độ nhiệm vụ người dùng tự báo (luyện tập). */
  questProgress: protectedProcedure
    .input(questProgressInput)
    .mutation(({ ctx, input }) => progressQuest(ctx.db, { userId: ctx.user.id, questKey: input.questKey })),
  /** Feed trang chủ (phân trang bằng cursor). */
  feed: protectedProcedure
    .input(feedInput)
    .query(({ ctx, input }) => getHomeFeed(ctx.db, { userId: ctx.user.id, cursor: input.cursor, limit: input.limit })),
});

export const postRouter = router({
  react: protectedProcedure
    .input(postReactInput)
    .mutation(({ ctx, input }) => reactToPost(ctx.db, { postId: input.postId, userId: ctx.user.id, kind: input.kind, on: input.on })),
  comment: protectedProcedure
    .input(postCommentInput)
    .mutation(({ ctx, input }) => commentOnPost(ctx.db, { postId: input.postId, userId: ctx.user.id, body: input.body })),
  comments: protectedProcedure
    .input(postCommentsInput)
    .query(({ ctx, input }) => listComments(ctx.db, { postId: input.postId, cursor: input.cursor })),
  create: protectedProcedure
    .input(createTextPostInput)
    .mutation(({ ctx, input }) => createTextPost(ctx.db, { userId: ctx.user.id, body: input.body, skillId: input.skillId })),
});

export const challengeRouter = router({
  list: protectedProcedure.query(({ ctx }) => getActiveChallenges(ctx.db, { userId: ctx.user.id })),
  join: protectedProcedure
    .input(joinChallengeInput)
    .mutation(({ ctx, input }) =>
      joinChallenge(ctx.db, { challengeId: input.challengeId, userId: ctx.user.id, proofId: input.proofId }),
    ),
  /** Bằng chứng đang chờ cộng đồng duyệt (ẩn danh người nộp). */
  pendingProofs: protectedProcedure.query(({ ctx }) => getPendingProofsForCommunity(ctx.db, { viewerId: ctx.user.id })),
});

export const duelRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const duels = await listDuels(ctx.db, { viewerId: ctx.user.id });
    return Promise.all(duels.map((d) => signDuel(ctx.storage, d)));
  }),
  get: protectedProcedure
    .input(duelIdInput)
    .query(async ({ ctx, input }) => signDuel(ctx.storage, await getDuel(ctx.db, { duelId: input.duelId, viewerId: ctx.user.id }))),
  vote: protectedProcedure
    .input(duelVoteInput)
    .mutation(({ ctx, input }) => voteDuel(ctx.db, { duelId: input.duelId, userId: ctx.user.id, choice: input.choice })),
});

export const socialRouter = router({
  follow: protectedProcedure.input(followInput).mutation(async ({ ctx, input }) =>
    follow(ctx.db, { followerId: ctx.user.id, followeeId: await userIdByHandle(ctx.db, input.handle) }),
  ),
  unfollow: protectedProcedure.input(followInput).mutation(async ({ ctx, input }) =>
    unfollow(ctx.db, { followerId: ctx.user.id, followeeId: await userIdByHandle(ctx.db, input.handle) }),
  ),
});

export const swapRouter = router({
  list: protectedProcedure.query(({ ctx }) => listSwaps(ctx.db, { userId: ctx.user.id })),
  propose: protectedProcedure.input(proposeSwapInput).mutation(async ({ ctx, input }) =>
    proposeSwap(ctx.db, {
      proposerId: ctx.user.id,
      receiverId: await userIdByHandle(ctx.db, input.receiverHandle),
      teachSkillId: input.teachSkillId,
      learnSkillId: input.learnSkillId,
      mode: input.mode,
    }),
  ),
  respond: protectedProcedure
    .input(respondSwapInput)
    .mutation(({ ctx, input }) =>
      respondSwap(ctx.db, { swapId: input.swapId, userId: ctx.user.id, action: input.action, scheduledAt: input.scheduledAt ?? null }),
    ),
  rate: protectedProcedure
    .input(rateSwapInput)
    .mutation(({ ctx, input }) =>
      rateSwap(ctx.db, { swapId: input.swapId, raterId: ctx.user.id, stars: input.stars, comment: input.comment ?? null }),
    ),
});

export const messageRouter = router({
  threads: protectedProcedure.query(({ ctx }) => listThreads(ctx.db, { userId: ctx.user.id })),
  /** Mở (hoặc tạo) cuộc trò chuyện với một người theo handle. */
  open: protectedProcedure.input(openThreadInput).mutation(async ({ ctx, input }) =>
    getOrCreateThread(ctx.db, { userId: ctx.user.id, otherUserId: await userIdByHandle(ctx.db, input.handle) }),
  ),
  list: protectedProcedure
    .input(threadMessagesInput)
    .query(({ ctx, input }) => listMessages(ctx.db, { threadId: input.threadId, userId: ctx.user.id, cursor: input.cursor })),
  send: protectedProcedure
    .input(sendMessageInput)
    .mutation(({ ctx, input }) => sendMessage(ctx.db, { threadId: input.threadId, senderId: ctx.user.id, body: input.body })),
});

export const notificationRouter = router({
  list: protectedProcedure
    .input(notificationsInput)
    .query(({ ctx, input }) => listNotifications(ctx.db, { userId: ctx.user.id, cursor: input.cursor })),
  markRead: protectedProcedure
    .input(markNotificationsReadInput)
    .mutation(({ ctx, input }) => markNotificationsRead(ctx.db, { userId: ctx.user.id, ids: input.ids })),
});

export const reportRouter = router({
  /** Báo cáo bằng chứng / người dùng / phiếu duyệt / bài đăng / kỹ năng. */
  create: protectedProcedure.input(createReportInput).mutation(({ ctx, input }) =>
    createReport(ctx.db, {
      reporterId: ctx.user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details ?? null,
    }),
  ),
});
