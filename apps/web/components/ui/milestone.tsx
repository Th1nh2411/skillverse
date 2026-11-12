import type { LucideIcon } from "lucide-react";
import { LevelPatch } from "@/components/ui/level-patch";
import { progressLabel } from "@/lib/milestone";
import { patchFabric, threadOf, type Rarity } from "@/lib/skill-visual";

const THREAD_VAR = {
  common: "var(--color-thread-common)",
  rare: "var(--color-thread-rare)",
  legendary: "var(--color-thread-legendary)",
} as const;

/**
 * Thanh mốc: mỗi mốc là một đoạn chỉ. Đã xong = chỉ liền, mốc kế tiếp = chỉ nét đứt hổ phách, còn lại = rãnh trống.
 * Thay cho câu "Cấp 3/5".
 */
export function MilestoneBar({
  value,
  max,
  verified,
  showNext = true,
  showCount = false,
  className = "",
}: {
  value: number;
  max: number;
  /** Số mốc đã được cộng đồng xác nhận (đoạn chỉ liền); phần còn lại tới `value` là tự đánh dấu (đoạn gạch chéo nhạt). Mặc định = value. */
  verified?: number;
  /** Tô mốc kế tiếp bằng nét đứt hổ phách. */
  showNext?: boolean;
  /** Hiện "X/5" bên phải. */
  showCount?: boolean;
  className?: string;
}) {
  const n = Math.max(1, max);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-label={`${progressLabel(value, n)}${verified !== undefined && verified < value ? `, ${verified} đã xác nhận` : ""}`}
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={value}
        className="flex flex-1 gap-1"
      >
        {Array.from({ length: n }, (_, i) => {
          const done = i < value;
          const solid = i < (verified ?? value);
          const next = showNext && i === value;
          return (
            <span
              key={i}
              className={`h-[6px] flex-1 rounded-full ${
                done ? (solid ? "bg-trail" : "bg-hatch") : next ? "border border-dashed border-accent" : "bg-surface-3"
              }`}
            />
          );
        })}
      </div>
      {showCount ? (
        <span aria-hidden className="tabular shrink-0 text-[13px] font-semibold text-muted">
          {value}/{n}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Điểm nhấn duy nhất: miếng vải thêu kèm dải băng khâu tên mốc ("Xong mốc: Trời mưa").
 * Dùng ở màn Lên cấp, thẻ chia sẻ. `stitch` chạy chuyển động khâu (tắt khi prefers-reduced-motion).
 */
export function MilestonePatch({
  categorySlug,
  rarity,
  icon,
  milestone,
  size = 120,
  stitch = false,
  label,
  className = "",
  prefix = true,
}: {
  categorySlug: string;
  rarity: Rarity;
  icon: LucideIcon;
  milestone: string;
  size?: number;
  stitch?: boolean;
  label?: string;
  className?: string;
  /** Hiện tiền tố "Xong mốc:" trên dải băng (tắt khi tiêu đề bên cạnh đã nói). */
  prefix?: boolean;
}) {
  const thread = THREAD_VAR[threadOf(rarity)];
  const small = size < 100;
  return (
    <div className={`relative inline-flex flex-col items-center ${className}`} role="img" aria-label={label ?? `Xong mốc ${milestone}`}>
      <LevelPatch categorySlug={categorySlug} rarity={rarity} icon={icon} size={size} stitch={stitch} />
      <span
        aria-hidden
        className={`${stitch ? "patch-ribbon" : ""} relative max-w-[min(15rem,90vw)] -rotate-2 rounded-[7px] text-center font-bold leading-tight shadow-[0_2px_0_rgba(0,0,0,0.25)] ${
          small ? "-mt-3 px-2.5 py-1 text-[11px]" : "-mt-5 px-4 py-1.5 text-[14px]"
        }`}
        style={{
          background: patchFabric(categorySlug),
          color: thread,
          outline: `1.5px dashed ${thread}`,
          outlineOffset: small ? -3 : -4,
        }}
      >
        {prefix ? <span className="font-semibold opacity-85">Xong mốc: </span> : null}
        {milestone}
      </span>
    </div>
  );
}
