import { ShieldCheck } from "lucide-react";
import { LevelPatch } from "@/components/ui/level-patch";
import type { Rarity } from "@/lib/skill-visual";

/** Thẻ thành tích (xem trước ở màn Lên cấp, hiển thị ở trang công khai). Chỉ tên hiển thị, không dữ liệu cá nhân khác. */
export function ShareCard({
  displayName,
  skillName,
  categorySlug,
  rarity,
  level,
  verifiedCount,
  size = "md",
}: {
  displayName: string;
  skillName: string;
  categorySlug: string;
  rarity: Rarity;
  level: number;
  verifiedCount: number;
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  return (
    <div
      className={`flex items-center rounded-[var(--radius-card)] border border-border bg-surface ${lg ? "gap-5 p-6" : "gap-3.5 p-4"}`}
    >
      <LevelPatch categorySlug={categorySlug} rarity={rarity} level={level} size={lg ? 96 : 60} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-display text-[13px] font-extrabold text-muted">SkillVerse</span>
        <p className={`font-bold leading-snug ${lg ? "text-[22px]" : "text-[16px]"}`}>
          {displayName} đạt cấp {level}
        </p>
        <p className={`text-muted ${lg ? "text-[16px]" : "text-[14px]"}`}>{skillName}</p>
        <p className="tabular mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-teal">
          <ShieldCheck size={14} aria-hidden />
          {verifiedCount} người xác thực
        </p>
      </div>
    </div>
  );
}
