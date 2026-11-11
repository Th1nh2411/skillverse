import { z } from "zod";

/**
 * Số kỹ năng tối thiểu khi onboarding (PRODUCT_BRIEF: "Chọn ≥ 3 kỹ năng").
 * Đây là quy tắc form tĩnh, không phải ngưỡng nghiệp vụ trong app_config.
 */
export const ONBOARDING_MIN_SKILLS = 3;
export const ONBOARDING_MAX_SKILLS = 20;

/** Trình độ tự đánh giá — CHỈ để gợi ý thử thách, không bao giờ ghi vào level. */
export const selfLevel = z.enum(["beginner", "some", "proficient"]);
export type SelfLevel = z.infer<typeof selfLevel>;

/** Nhãn tiếng Việt cho UI. */
export const SELF_LEVEL_LABELS: Record<SelfLevel, string> = {
  beginner: "Mới bắt đầu",
  some: "Biết chút ít",
  proficient: "Khá thành thạo",
};

/** onboarding.complete */
export const onboardingCompleteInput = z.object({
  skillIds: z
    .array(z.uuid())
    .min(ONBOARDING_MIN_SKILLS, `Chọn ít nhất ${ONBOARDING_MIN_SKILLS} kỹ năng`)
    .max(ONBOARDING_MAX_SKILLS, `Chọn tối đa ${ONBOARDING_MAX_SKILLS} kỹ năng`)
    .refine((ids) => new Set(ids).size === ids.length, "Kỹ năng bị trùng"),
  /** skillId → trình độ tự đánh giá (tùy chọn). */
  selfLevels: z.record(z.uuid(), selfLevel).default({}),
});
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteInput>;
