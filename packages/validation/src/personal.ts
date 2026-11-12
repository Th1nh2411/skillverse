import { z } from "zod";

/** milestone.check / milestone.uncheck — tự đánh dấu mốc (D73). */
export const milestoneCheckInput = z.object({ skillLevelId: z.uuid() });
export type MilestoneCheckInput = z.infer<typeof milestoneCheckInput>;

/** save.toggle — lưu bài viết / kỹ năng / bằng chứng (D74). */
export const saveTargetType = z.enum(["post", "skill", "proof"]);
export const saveToggleInput = z.object({ targetType: saveTargetType, targetId: z.uuid() });
export type SaveToggleInput = z.infer<typeof saveToggleInput>;

/** save.list — con trỏ mờ do server trả. */
export const savedListInput = z
  .object({
    cursor: z.string().max(500).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .default({ limit: 20 });
export type SavedListInput = z.infer<typeof savedListInput>;
