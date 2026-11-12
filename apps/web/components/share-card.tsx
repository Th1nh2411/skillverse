import { ShieldCheck } from "lucide-react";
import { MilestonePatch } from "@/components/ui/milestone";
import { skillIcon, type Rarity } from "@/lib/skill-visual";

/**
 * Thẻ thành tích (xem trước ở màn Lên cấp, hiển thị ở trang công khai): miếng vải khâu tên mốc.
 * Chỉ tên hiển thị, không dữ liệu cá nhân khác.
 */
export function ShareCard({
  displayName,
  skillSlug,
  skillName,
  categorySlug,
  rarity,
  milestone,
  verifiedCount,
  size = "md",
}: {
  displayName: string;
  skillSlug: string;
  skillName: string;
  categorySlug: string;
  rarity: Rarity;
  milestone: string;
  verifiedCount: number;
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  return (
    <div
      className={`flex items-center rounded-[var(--radius-card)] border border-border bg-surface ${lg ? "gap-5 p-6" : "gap-4 p-4"}`}
    >
      <MilestonePatch
        categorySlug={categorySlug}
        rarity={rarity}
        icon={skillIcon(skillSlug, categorySlug)}
        milestone={milestone}
        size={lg ? 96 : 68}
        prefix={false}
        className="shrink-0"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-display text-[13px] font-extrabold text-muted">SkillVerse</span>
        <p className={`font-bold leading-snug ${lg ? "text-[22px]" : "text-[16px]"}`}>{displayName}</p>
        <p className={`leading-snug ${lg ? "text-[16px]" : "text-[14px]"}`}>
          <span className="text-muted">{skillName}: </span>
          xong mốc <b className="font-bold">{milestone}</b>
        </p>
        {verifiedCount > 0 ? (
          <p className="tabular mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-teal">
            <ShieldCheck size={14} aria-hidden />
            {verifiedCount} người công nhận
          </p>
        ) : null}
      </div>
    </div>
  );
}
