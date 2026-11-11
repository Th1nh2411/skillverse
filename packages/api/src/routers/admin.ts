/**
 * Trang quản trị tối giản cho biên tập viên (editorProcedure; domain cũng tự kiểm tra quyền biên tập).
 * Thu hồi level đi qua finalizeProof (nhánh revoke) bên trong resolveReport — không ghi level ở đây.
 */
import {
  createDuel,
  listAppeals,
  listDisputedProofs,
  listReports,
  listUserSanctions,
  resolveAppeal,
  resolveDisputedProof,
  resolveReport,
  sanctionUser,
} from "@skillverse/domain";
import {
  createDuelInput,
  listReportsInput,
  resolveAppealInput,
  resolveDisputedProofInput,
  resolveReportInput,
  sanctionUserInput,
} from "@skillverse/validation";
import { VIEW_URL_TTL_S } from "../media";
import { editorProcedure, router } from "../trpc";

const userSanctionsInput = sanctionUserInput.pick({ userId: true });

export const adminRouter = router({
  reports: editorProcedure
    .input(listReportsInput)
    .query(({ ctx, input }) => listReports(ctx.db, { editorId: ctx.user.id, status: input.status, cursor: input.cursor })),

  resolveReport: editorProcedure.input(resolveReportInput).mutation(({ ctx, input }) =>
    resolveReport(ctx.db, {
      reportId: input.reportId,
      editorId: ctx.user.id,
      decision: input.decision,
      outcome: input.outcome ?? null,
    }),
  ),

  sanction: editorProcedure.input(sanctionUserInput).mutation(({ ctx, input }) =>
    sanctionUser(ctx.db, {
      editorId: ctx.user.id,
      userId: input.userId,
      kind: input.kind,
      reason: input.reason,
      durationDays: input.durationDays ?? null,
      reportId: input.reportId ?? null,
    }),
  ),

  userSanctions: editorProcedure
    .input(userSanctionsInput)
    .query(({ ctx, input }) => listUserSanctions(ctx.db, { editorId: ctx.user.id, userId: input.userId })),

  /** Hàng đợi bằng chứng trùng hash video, kèm URL xem có thời hạn. */
  disputedProofs: editorProcedure.query(async ({ ctx }) => {
    const items = await listDisputedProofs(ctx.db, { editorId: ctx.user.id });
    return Promise.all(
      items.map(async ({ mediaKey, ...p }) => ({
        ...p,
        video: { url: await ctx.storage.presignGet(mediaKey, VIEW_URL_TTL_S), expiresAt: new Date(Date.now() + VIEW_URL_TTL_S * 1000) },
      })),
    );
  }),

  resolveDisputedProof: editorProcedure
    .input(resolveDisputedProofInput)
    .mutation(({ ctx, input }) =>
      resolveDisputedProof(ctx.db, { proofId: input.proofId, editorId: ctx.user.id, decision: input.decision }),
    ),

  appeals: editorProcedure.query(({ ctx }) => listAppeals(ctx.db, { editorId: ctx.user.id })),

  resolveAppeal: editorProcedure
    .input(resolveAppealInput)
    .mutation(({ ctx, input }) => resolveAppeal(ctx.db, { appealId: input.appealId, editorId: ctx.user.id, decision: input.decision })),

  /** Tạo trận đấu 1v1 (biên tập viên điều phối thử thách). */
  createDuel: editorProcedure.input(createDuelInput).mutation(({ ctx, input }) =>
    createDuel(ctx.db, {
      creatorId: ctx.user.id,
      skillId: input.skillId,
      metric: input.metric,
      userA: input.userA,
      userB: input.userB,
      proofA: input.proofA,
      proofB: input.proofB,
      voteEndsAt: input.voteEndsAt,
    }),
  ),
});
