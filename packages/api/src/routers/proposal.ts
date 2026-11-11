/** Giai đoạn 4 — Cộng đồng góp ý: đề xuất kỹ năng mới, sửa tiêu chí (bỏ phiếu có trọng số), bình luận. */
import {
  commentOnProposal,
  getProposal,
  listProposalComments,
  listProposals,
  proposeCriteriaEdit,
  proposeNewSkill,
  supportProposal,
  voteCriteriaEdit,
} from "@skillverse/domain";
import {
  criteriaEditProposalInput,
  criteriaVoteInput,
  listProposalsInput,
  newSkillProposalInput,
  proposalCommentInput,
  proposalCommentsInput,
  proposalIdInput,
} from "@skillverse/validation";
import { protectedProcedure, router } from "../trpc";

export const proposalRouter = router({
  list: protectedProcedure.input(listProposalsInput).query(({ ctx, input }) =>
    listProposals(ctx.db, {
      viewerId: ctx.user.id,
      kind: input.kind,
      skillSlug: input.skillSlug,
      status: input.status,
      cursor: input.cursor,
    }),
  ),

  get: protectedProcedure
    .input(proposalIdInput)
    .query(({ ctx, input }) => getProposal(ctx.db, { proposalId: input.proposalId, viewerId: ctx.user.id })),

  /** Đề xuất kỹ năng mới (levels[i] = tiêu chí cấp i+1). */
  createNewSkill: protectedProcedure.input(newSkillProposalInput).mutation(({ ctx, input }) =>
    proposeNewSkill(ctx.db, {
      authorId: ctx.user.id,
      name: input.name,
      categorySlug: input.categorySlug,
      description: input.description,
      riskLevel: input.riskLevel,
      levels: input.levels,
      rationale: input.rationale,
    }),
  ),

  /** Ủng hộ đề xuất kỹ năng mới. */
  support: protectedProcedure
    .input(proposalIdInput)
    .mutation(({ ctx, input }) => supportProposal(ctx.db, { proposalId: input.proposalId, userId: ctx.user.id })),

  /** Đề xuất sửa tiêu chí một cấp (thông qua → criteria_versions mới, domain xử lý). */
  createCriteriaEdit: protectedProcedure.input(criteriaEditProposalInput).mutation(({ ctx, input }) =>
    proposeCriteriaEdit(ctx.db, {
      authorId: ctx.user.id,
      skillLevelId: input.skillLevelId,
      criteria: input.criteria,
      summary: input.summary,
      rationale: input.rationale ?? null,
    }),
  ),

  /** Bỏ phiếu sửa tiêu chí (trọng số do domain tính; đổi phiếu được trước hạn). */
  vote: protectedProcedure
    .input(criteriaVoteInput)
    .mutation(({ ctx, input }) => voteCriteriaEdit(ctx.db, { proposalId: input.proposalId, userId: ctx.user.id, vote: input.vote })),

  comment: protectedProcedure
    .input(proposalCommentInput)
    .mutation(({ ctx, input }) => commentOnProposal(ctx.db, { proposalId: input.proposalId, userId: ctx.user.id, body: input.body })),

  comments: protectedProcedure
    .input(proposalCommentsInput)
    .query(({ ctx, input }) => listProposalComments(ctx.db, { proposalId: input.proposalId, cursor: input.cursor })),
});
