import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { initials } from "@/lib/skill-visual";

/** Thanh tiến độ. `tone` chọn màu phần đã đi: hổ phách cho XP, vải sáng cho kỹ năng. */
export function ProgressBar({
  value,
  max,
  tone = "accent",
  size = "md",
  label,
}: {
  value: number;
  max: number;
  tone?: "accent" | "thread" | "teal";
  size?: "sm" | "md";
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = tone === "accent" ? "bg-accent" : tone === "teal" ? "bg-teal" : "bg-thread-common";
  const h = size === "sm" ? "h-[5px]" : "h-2";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`${h} w-full overflow-hidden rounded-full bg-surface-3`}
    >
      <div className={`${h} ${fill} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const AVATAR_TONES = ["#3b4a2c", "#2b3a48", "#4a3a26", "#3a2f45", "#24433d"];

/** Avatar chữ cái đầu; màu nền cố định theo tên để dễ nhận ra. */
export function Avatar({
  name,
  size = 40,
  ring,
  className = "",
}: {
  name: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AVATAR_TONES[h % AVATAR_TONES.length];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-text ${
        ring ? "border-[3px] border-accent" : ""
      } ${className}`}
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

/** Màn trống là lời mời hành động. */
export function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center">
      <Icon size={32} strokeWidth={1.8} className="text-muted" aria-hidden />
      <p className="max-w-[28ch] text-[15px] font-semibold">{title}</p>
      {action}
    </div>
  );
}

/** Khối chờ tải, giữ bố cục ổn định. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[12px] bg-surface-2 ${className}`} />;
}
