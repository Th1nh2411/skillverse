import Link from "next/link";
import { Video } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { MilestoneBar } from "@/components/ui/milestone";
import { milestoneName } from "@/lib/milestone";
import { skillIcon, type Rarity } from "@/lib/skill-visual";

type SkillLike = {
  slug: string;
  name: string;
  category: { slug: string };
  rarity: Rarity;
  level: number;
  maxLevel: number;
  pendingTargetLevel: number | null;
  nextLevelTitle: string | null;
};

/** Chọn kỹ năng gần xong nhất, chưa có video chờ duyệt, để gợi ý bước tiếp theo. */
export function pickNextSkill<T extends SkillLike>(skills: T[]): T | null {
  const open = skills.filter((s) => s.level < s.maxLevel && s.pendingTargetLevel === null);
  open.sort((a, b) => b.level / b.maxLevel - a.level / a.maxLevel);
  return open[0] ?? null;
}

/** Lời nhắc bước tiếp theo: "Mốc tiếp: Trời gió" + nút quay video. */
export function NextMilestoneCard({ s }: { s: SkillLike }) {
  const next = milestoneName(s.nextLevelTitle, s.level + 1);
  return (
    <section
      aria-label="Mốc tiếp theo"
      className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-3.5 outline outline-1 outline-accent-line"
    >
      <Link href={`/skills/${s.slug}`} className="flex items-center gap-3">
        <LevelPatch
          categorySlug={s.category.slug}
          rarity={s.rarity}
          state={s.level > 0 ? "earned" : "practicing"}
          icon={skillIcon(s.slug, s.category.slug)}
          size={48}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[13px] text-muted">
            {s.name}
          </span>
          <span className="truncate text-[16px] font-bold leading-tight">
            <span className="font-semibold text-accent">Mốc tiếp: </span>
            {next}
          </span>
          <MilestoneBar value={s.level} max={s.maxLevel} showCount />
        </span>
      </Link>
      <ButtonLink href={`/proof/new?skill=${s.slug}`} size="md" className="w-full">
        <Video size={18} aria-hidden />
        Quay video
      </ButtonLink>
    </section>
  );
}
