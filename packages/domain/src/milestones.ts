/**
 * Mốc kỹ năng (D72): người dùng thấy mỗi cấp `skill_levels.level` như một "mốc" có tên (`title`) và hướng dẫn
 * (`description`). Số cấp vẫn là nền tảng (cạnh required_level, điều kiện người duyệt, XP, thu hồi).
 * `description` là hướng dẫn, KHÔNG phải tiêu chí chấm — tiêu chí vẫn chỉ đổi qua criteria_versions mới.
 */
import { MILESTONE_DESCRIPTION_MAX, MILESTONE_TITLE_MAX } from "@skillverse/validation";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";

/** Tra tên mốc theo (skillId, level). Level 0 / không có → null. */
export type LevelTitleLookup = (skillId: string, level: number | null | undefined) => string | null;

export type LevelIndex = {
  titleOf: LevelTitleLookup;
  /** skill_levels.id theo (skillId, level); level 0 / không có → null. */
  idOf: (skillId: string, level: number | null | undefined) => string | null;
};

/** Nạp tên + id mốc của mọi cấp cho các kỹ năng cho trước (một truy vấn). */
export async function loadLevelIndex(db: Db, skillIds: Iterable<string>): Promise<LevelIndex> {
  const ids = [...new Set(skillIds)];
  const map = new Map<string, { id: string; title: string | null }>();
  if (ids.length > 0) {
    const rows = await db.skillLevel.findMany({
      where: { skillId: { in: ids } },
      select: { id: true, skillId: true, level: true, title: true },
    });
    for (const r of rows) map.set(`${r.skillId}:${r.level}`, { id: r.id, title: r.title });
  }
  const get = (skillId: string, level: number | null | undefined) =>
    level == null || level < 1 ? undefined : map.get(`${skillId}:${level}`);
  return { titleOf: (s, l) => get(s, l)?.title ?? null, idOf: (s, l) => get(s, l)?.id ?? null };
}

/** Nạp tên mốc của mọi cấp cho các kỹ năng cho trước (một truy vấn). */
export async function loadLevelTitles(db: Db, skillIds: Iterable<string>): Promise<LevelTitleLookup> {
  return (await loadLevelIndex(db, skillIds)).titleOf;
}

/** Trường tiến độ chung cho kỹ năng của người dùng (hồ sơ, profile.skills, nút cây). */
export type UserSkillProgressFields = {
  /** = level đã xác thực (tiện cho tóm tắt UI). */
  verifiedCount: number;
  /** skill_levels.id của mốc kế tiếp sau selfLevel (null khi đã xong mốc cuối). */
  nextSkillLevelId: string | null;
  /** Mốc mà video bằng chứng sẽ nhắm tới = level đã xác thực + 1 (null khi đã xác thực mốc cuối). */
  verifyLevel: number | null;
  verifyLevelTitle: string | null;
  verifySkillLevelId: string | null;
};

export function userSkillProgressFields(
  idx: LevelIndex,
  skillId: string,
  verifiedLevel: number,
  selfLevel: number,
  maxLevel: number,
): UserSkillProgressFields {
  const verifyLevel = verifiedLevel < maxLevel ? verifiedLevel + 1 : null;
  return {
    verifiedCount: verifiedLevel,
    nextSkillLevelId: selfLevel < maxLevel ? idx.idOf(skillId, selfLevel + 1) : null,
    verifyLevel,
    verifyLevelTitle: idx.titleOf(skillId, verifyLevel),
    verifySkillLevelId: idx.idOf(skillId, verifyLevel),
  };
}

/** Nhãn hiển thị cho một cấp: "mốc <tên>" hoặc dự phòng "cấp N" khi chưa có tên. */
export function milestoneLabel(title: string | null | undefined, level: number): string {
  const t = title?.trim();
  return t ? `mốc ${t}` : `cấp ${level}`;
}

/** Nội dung bài level_up: "<kỹ năng>: xong mốc <tên>" (dự phòng "lên cấp N"). */
export function levelUpPostBody(skillName: string, title: string | null | undefined, level: number): string {
  const t = title?.trim();
  return t ? `${skillName}: xong mốc ${t}` : `${skillName}: lên cấp ${level}`;
}

export type MilestoneView = {
  skillLevelId: string;
  skillId: string;
  level: number;
  title: string | null;
  description: string | null;
};

/**
 * Biên tập viên sửa tên / hướng dẫn của một mốc. KHÔNG đụng tiêu chí (criteria_versions) — mô tả chỉ là hướng dẫn.
 * `title`: bỏ qua = giữ nguyên; `description`: bỏ qua = giữ nguyên, null/"" = xóa.
 */
export async function updateMilestone(
  db: Db,
  p: { editorId: string; skillLevelId: string; title?: string; description?: string | null },
): Promise<MilestoneView> {
  const data: { title?: string; description?: string | null } = {};
  if (p.title !== undefined) {
    const t = p.title.trim();
    if (t.length < 1 || t.length > MILESTONE_TITLE_MAX) {
      throw new DomainError("BAD_REQUEST", `Tên mốc cần 1–${MILESTONE_TITLE_MAX} ký tự.`);
    }
    data.title = t;
  }
  if (p.description !== undefined) {
    const d = p.description?.trim() ?? "";
    if (d.length > MILESTONE_DESCRIPTION_MAX) {
      throw new DomainError("BAD_REQUEST", `Hướng dẫn tối đa ${MILESTONE_DESCRIPTION_MAX} ký tự.`);
    }
    data.description = d || null;
  }
  if (Object.keys(data).length === 0) throw new DomainError("BAD_REQUEST", "Không có gì để sửa.");

  return withTx(db, async (tx) => {
    const u = await tx.user.findUnique({ where: { id: p.editorId }, select: { isEditor: true, deletedAt: true } });
    if (!u?.isEditor || u.deletedAt) throw new DomainError("FORBIDDEN", "Chỉ biên tập viên được thực hiện.");
    const sl = await tx.skillLevel.findUnique({ where: { id: p.skillLevelId }, select: { id: true } });
    if (!sl) throw new DomainError("NOT_FOUND", "Không tìm thấy mốc kỹ năng.");
    const r = await tx.skillLevel.update({
      where: { id: sl.id },
      data,
      select: { id: true, skillId: true, level: true, title: true, description: true },
    });
    return { skillLevelId: r.id, skillId: r.skillId, level: r.level, title: r.title, description: r.description };
  });
}
