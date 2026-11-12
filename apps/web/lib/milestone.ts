/**
 * Mốc (milestone): mỗi kỹ năng là một chuỗi mốc có tên (skill_levels.title), ví dụ Nhóm lửa:
 * Bật lửa → Đá lửa → Trời gió → Trời mưa → Một que diêm. Số cấp chỉ dùng nội bộ; người dùng thấy tên mốc
 * và thanh tiến độ "X/5".
 */

/** Tên hiển thị của mốc. Thiếu tên (dữ liệu cũ) thì dùng "Mốc N". */
export function milestoneName(title: string | null | undefined, level: number): string {
  const t = title?.trim();
  return t ? t : `Mốc ${level}`;
}

/** Danh sách mốc tối giản để tra tên theo số. */
export type MilestoneRef = { level: number; title: string | null };

export function titleAt(levels: MilestoneRef[], level: number): string {
  return milestoneName(levels.find((l) => l.level === level)?.title, level);
}

/** Câu ngắn cho trạng thái tiến độ của một kỹ năng, dùng cho aria-label. */
export function progressLabel(level: number, max: number): string {
  return `Xong ${level} trên ${max} mốc`;
}

