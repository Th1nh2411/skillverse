import { z } from "zod";

/** Quy tắc form (mockup NewSkill: "Tối thiểu 3 mốc"); không phải ngưỡng nghiệp vụ. Kỹ năng là chuỗi 3–5 mốc (D72). */
export const NEW_SKILL_MIN_LEVELS = 3;
export const NEW_SKILL_MAX_LEVELS = 5;
/** Giới hạn tên mốc / hướng dẫn mốc (khớp MILESTONE_TITLE_MAX / MILESTONE_DESCRIPTION_MAX trong domain). */
export const MILESTONE_TITLE_MAX = 40;
export const MILESTONE_DESCRIPTION_MAX = 300;
export const MAX_CRITERIA_PER_LEVEL = 8;

export const riskLevelInput = z.enum(["none", "low", "high"]);

export const criterionInput = z.object({
  text: z.string().trim().min(3, "Tiêu chí quá ngắn").max(200, "Tiêu chí tối đa 200 ký tự"),
  kind: z.enum(["checklist", "time_limit", "count"]).default("checklist"),
  threshold: z.number().nonnegative().optional(),
});
export type CriterionInputValue = z.infer<typeof criterionInput>;

export const levelCriteria = z.array(criterionInput).min(1, "Mỗi mốc cần ít nhất một tiêu chí").max(MAX_CRITERIA_PER_LEVEL);

export const milestoneTitle = z
  .string()
  .trim()
  .min(1, "Nhập tên mốc")
  .max(MILESTONE_TITLE_MAX, `Tên mốc tối đa ${MILESTONE_TITLE_MAX} ký tự`);
export const milestoneDescription = z
  .string()
  .trim()
  .max(MILESTONE_DESCRIPTION_MAX, `Hướng dẫn tối đa ${MILESTONE_DESCRIPTION_MAX} ký tự`);

/** Một mốc trong đề xuất kỹ năng mới: tên mốc, hướng dẫn (tùy chọn), tiêu chí chấm (việc cần làm). */
export const newSkillLevelInput = z.object({
  title: milestoneTitle,
  description: milestoneDescription.optional(),
  criteria: levelCriteria,
});
export type NewSkillLevelInputValue = z.infer<typeof newSkillLevelInput>;

/** proposal.createNewSkill — `levels[i]` là mốc i+1. */
export const newSkillProposalInput = z.object({
  name: z.string().trim().min(2, "Tên quá ngắn").max(80, "Tên tối đa 80 ký tự"),
  categorySlug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  description: z.string().trim().max(1000).optional(),
  riskLevel: riskLevelInput.default("none"),
  levels: z
    .array(newSkillLevelInput)
    .min(NEW_SKILL_MIN_LEVELS, `Cần tối thiểu ${NEW_SKILL_MIN_LEVELS} mốc`)
    .max(NEW_SKILL_MAX_LEVELS, `Tối đa ${NEW_SKILL_MAX_LEVELS} mốc`),
  rationale: z.string().trim().max(1000).optional(),
});
export type NewSkillProposalInput = z.infer<typeof newSkillProposalInput>;

export const proposalIdInput = z.object({ proposalId: z.uuid() });
export type ProposalIdInput = z.infer<typeof proposalIdInput>;

/** admin: quyết định kỹ năng mới */
export const decideNewSkillInput = z.object({
  proposalId: z.uuid(),
  decision: z.enum(["accepted", "rejected"]),
  note: z.string().trim().max(1000).optional(),
});
export type DecideNewSkillInput = z.infer<typeof decideNewSkillInput>;

/** proposal.createCriteriaEdit */
export const criteriaEditProposalInput = z.object({
  skillLevelId: z.uuid(),
  criteria: levelCriteria,
  summary: z.string().trim().min(5, "Tóm tắt quá ngắn").max(200),
  rationale: z.string().trim().max(1000).optional(),
});
export type CriteriaEditProposalInput = z.infer<typeof criteriaEditProposalInput>;

/** proposal.vote */
export const criteriaVoteInput = z.object({ proposalId: z.uuid(), vote: z.enum(["agree", "disagree"]) });
export type CriteriaVoteInput = z.infer<typeof criteriaVoteInput>;

/** proposal.list */
export const listProposalsInput = z
  .object({
    kind: z.enum(["new_skill", "edit_criteria"]).optional(),
    skillSlug: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
    status: z.enum(["gathering", "voting", "editor_review", "accepted", "rejected", "expired"]).optional(),
    cursor: z.uuid().optional(),
  })
  .default({});
export type ListProposalsInput = z.infer<typeof listProposalsInput>;

/** proposal.comment */
export const proposalCommentInput = z.object({
  proposalId: z.uuid(),
  body: z.string().trim().min(1, "Bình luận trống").max(1000, "Tối đa 1000 ký tự"),
});
export type ProposalCommentInput = z.infer<typeof proposalCommentInput>;

export const proposalCommentsInput = z.object({ proposalId: z.uuid(), cursor: z.uuid().optional() });

/** admin.updateMilestone — biên tập viên sửa tên / hướng dẫn một mốc (không sửa tiêu chí). description null = xóa. */
export const updateMilestoneInput = z
  .object({
    skillLevelId: z.uuid(),
    title: milestoneTitle.optional(),
    description: milestoneDescription.nullable().optional(),
  })
  .refine((v) => v.title !== undefined || v.description !== undefined, { message: "Không có gì để sửa" });
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInput>;
