import Link from "next/link";
import { Hourglass, ShieldCheck } from "lucide-react";
import { LevelPatch } from "@/components/ui/level-patch";
import { MilestoneBar } from "@/components/ui/milestone";
import { milestoneName } from "@/lib/milestone";
import { skillIcon, type Rarity } from "@/lib/skill-visual";

/**
 * Một dòng kỹ năng trong hồ sơ: tên kỹ năng, mốc đã xong gần nhất (dòng phụ) và thanh mốc X/5.
 * Không nối bằng dấu chấm giữa: hai dòng có thứ bậc rõ.
 */
export function SkillProgressRow({
  s,
  pending = false,
  verifiedByCount = 0,
  patchSize = 52,
}: {
  s: {
    slug: string;
    name: string;
    category: { slug: string };
    rarity: Rarity;
    /** Mốc đã được công nhận (video). */
    level: number;
    /** Tiến độ hiển thị: tự đánh dấu hoặc được công nhận. */
    selfLevel: number;
    selfLevelTitle: string | null;
    maxLevel: number;
  };
  pending?: boolean;
  verifiedByCount?: number;
  patchSize?: number;
}) {
  const done = s.selfLevel > 0;
  const current = done ? milestoneName(s.selfLevelTitle, s.selfLevel) : null;
  return (
    <Link
      href={`/skills/${s.slug}`}
      className="flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-surface active:bg-surface-2"
    >
      <LevelPatch
        categorySlug={s.category.slug}
        rarity={s.rarity}
        state={s.level > 0 ? "earned" : "practicing"}
        icon={skillIcon(s.slug, s.category.slug)}
        size={patchSize}
        label={s.name}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">{s.name}</span>
          {pending ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-muted">
              <Hourglass size={13} aria-hidden />
              Chờ duyệt
            </span>
          ) : verifiedByCount > 0 ? (
            <span className="tabular inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-teal">
              <ShieldCheck size={14} aria-hidden />
              <span className="sr-only">Đã xác thực bởi</span>
              {verifiedByCount}
              <span className="sr-only">người</span>
            </span>
          ) : null}
        </div>
        <span className={`truncate text-[13px] ${done ? "text-text" : "text-muted"}`}>
          {current ? (
            <>
              <span className="sr-only">Đã xong mốc </span>
              {current}
            </>
          ) : (
            "Chưa xong mốc nào"
          )}
        </span>
        <MilestoneBar value={s.selfLevel} max={s.maxLevel} showCount showNext={false} />
      </div>
    </Link>
  );
}
