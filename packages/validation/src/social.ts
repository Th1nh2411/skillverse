import { z } from "zod";
import { reportReason } from "./proofs";

const cursor = z.string().min(1).max(500).optional();
const handleSchema = z.string().regex(/^[a-z0-9_]{3,30}$/, "Tên người dùng không hợp lệ");

// --- Nhiệm vụ ngày ---
/** home.questProgress — chỉ nhiệm vụ người dùng tự ghi nhận (luyện tập). */
export const questProgressInput = z.object({ questKey: z.string().min(1).max(50) });
export type QuestProgressInput = z.infer<typeof questProgressInput>;

// --- Feed ---
export const feedInput = z.object({ cursor, limit: z.number().int().min(1).max(50).default(20) }).default({ limit: 20 });
export type FeedInput = z.infer<typeof feedInput>;

export const reactionKind = z.enum(["like", "cheer"]);
export const postReactInput = z.object({ postId: z.uuid(), kind: reactionKind.default("cheer"), on: z.boolean().default(true) });
export type PostReactInput = z.infer<typeof postReactInput>;

export const postCommentInput = z.object({
  postId: z.uuid(),
  body: z.string().trim().min(1, "Bình luận trống").max(1000, "Tối đa 1000 ký tự"),
});
export type PostCommentInput = z.infer<typeof postCommentInput>;

export const postCommentsInput = z.object({ postId: z.uuid(), cursor: z.uuid().optional() });
export type PostCommentsInput = z.infer<typeof postCommentsInput>;

export const createTextPostInput = z.object({
  body: z.string().trim().min(1, "Nội dung trống").max(2000, "Tối đa 2000 ký tự"),
  skillId: z.uuid().optional(),
});
export type CreateTextPostInput = z.infer<typeof createTextPostInput>;

// --- Thử thách / đấu ---
export const joinChallengeInput = z.object({ challengeId: z.uuid(), proofId: z.uuid() });
export type JoinChallengeInput = z.infer<typeof joinChallengeInput>;

export const duelIdInput = z.object({ duelId: z.uuid() });
export type DuelIdInput = z.infer<typeof duelIdInput>;

export const duelVoteInput = z.object({ duelId: z.uuid(), choice: z.uuid() });
export type DuelVoteInput = z.infer<typeof duelVoteInput>;

export const createDuelInput = z.object({
  skillId: z.uuid(),
  metric: z.string().trim().min(1).max(200),
  userA: z.uuid(),
  userB: z.uuid(),
  proofA: z.uuid().optional(),
  proofB: z.uuid().optional(),
  voteEndsAt: z.coerce.date(),
});
export type CreateDuelInput = z.infer<typeof createDuelInput>;

// --- Báo cáo / xử phạt (biên tập viên) ---
export const reportTarget = z.enum(["proof", "user", "review", "post", "skill"]);
export const createReportInput = z.object({
  targetType: reportTarget,
  targetId: z.uuid(),
  reason: reportReason,
  details: z.string().trim().max(1000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportInput>;

export const listReportsInput = z
  .object({
    status: z.enum(["open", "investigating", "confirmed", "dismissed"]).optional(),
    cursor: z.uuid().optional(),
  })
  .default({});
export type ListReportsInput = z.infer<typeof listReportsInput>;

export const resolveReportInput = z.object({
  reportId: z.uuid(),
  decision: z.enum(["confirmed", "dismissed"]),
  outcome: z.string().trim().max(1000).optional(),
});
export type ResolveReportInput = z.infer<typeof resolveReportInput>;

export const sanctionKindInput = z.enum(["warning", "review_ban", "post_ban", "suspension"]);
export const SANCTION_KIND_LABELS: Record<z.infer<typeof sanctionKindInput>, string> = {
  warning: "Cảnh cáo",
  review_ban: "Cấm duyệt",
  post_ban: "Cấm đăng bài",
  suspension: "Tạm ngưng tài khoản",
};
export const sanctionUserInput = z.object({
  userId: z.uuid(),
  kind: sanctionKindInput,
  reason: z.string().trim().min(3, "Cần nêu lý do").max(1000),
  durationDays: z.number().int().min(1).max(3650).optional(),
  reportId: z.uuid().optional(),
});
export type SanctionUserInput = z.infer<typeof sanctionUserInput>;

export const resolveDisputedProofInput = z.object({ proofId: z.uuid(), decision: z.enum(["clear", "remove"]) });
export type ResolveDisputedProofInput = z.infer<typeof resolveDisputedProofInput>;

// --- Xã hội ---
export const followInput = z.object({ handle: handleSchema });
export type FollowInput = z.infer<typeof followInput>;

export const swapMode = z.enum(["in_person", "video"]);
export const proposeSwapInput = z.object({
  receiverHandle: handleSchema,
  teachSkillId: z.uuid(),
  learnSkillId: z.uuid(),
  mode: swapMode,
});
export type ProposeSwapInput = z.infer<typeof proposeSwapInput>;

export const respondSwapInput = z.object({
  swapId: z.uuid(),
  action: z.enum(["accept", "decline", "cancel", "complete"]),
  scheduledAt: z.coerce.date().optional(),
});
export type RespondSwapInput = z.infer<typeof respondSwapInput>;

export const rateSwapInput = z.object({
  swapId: z.uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
export type RateSwapInput = z.infer<typeof rateSwapInput>;

export const openThreadInput = z.object({ handle: handleSchema });
export type OpenThreadInput = z.infer<typeof openThreadInput>;

export const threadMessagesInput = z.object({ threadId: z.uuid(), cursor: z.uuid().optional() });
export type ThreadMessagesInput = z.infer<typeof threadMessagesInput>;

export const sendMessageInput = z.object({
  threadId: z.uuid(),
  body: z.string().trim().min(1, "Tin nhắn trống").max(2000, "Tối đa 2000 ký tự"),
});
export type SendMessageInput = z.infer<typeof sendMessageInput>;

export const notificationsInput = z.object({ cursor: z.uuid().optional() }).default({});
export const markNotificationsReadInput = z.object({ ids: z.array(z.uuid()).max(100).optional() }).default({});
