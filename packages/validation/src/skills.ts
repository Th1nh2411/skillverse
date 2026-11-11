import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9-]{2,80}$/, "Mã không hợp lệ");
const handleSchema = z.string().regex(/^[a-z0-9_]{3,30}$/, "Tên người dùng không hợp lệ");

/** skill.tree */
export const skillTreeInput = z.object({ categorySlug: slugSchema });
export type SkillTreeInput = z.infer<typeof skillTreeInput>;

/** skill.detail */
export const skillDetailInput = z.object({ slug: slugSchema });
export type SkillDetailInput = z.infer<typeof skillDetailInput>;

/** skill.search */
export const skillSearchInput = z.object({
  query: z.string().trim().min(1, "Nhập từ khóa").max(80, "Từ khóa quá dài"),
  categorySlug: slugSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type SkillSearchInput = z.infer<typeof skillSearchInput>;

/** discover.home */
export const discoverHomeInput = z
  .object({ categorySlug: slugSchema.optional() })
  .default({});
export type DiscoverHomeInput = z.infer<typeof discoverHomeInput>;

/** profile.byHandle */
export const profileByHandleInput = z.object({ handle: handleSchema });
export type ProfileByHandleInput = z.infer<typeof profileByHandleInput>;
