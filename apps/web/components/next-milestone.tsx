"use client";
import Link from "next/link";
import { Check, Video } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { MilestoneBar } from "@/components/ui/milestone";
import { useMilestoneFlow } from "@/components/milestone-tick";
import { milestoneName } from "@/lib/milestone";
import { skillIcon, type Rarity } from "@/lib/skill-visual";

type SkillLike = {
  slug: string;
  name: string;
  category: { slug: string };
  rarity: Rarity;
  level: number;
  selfLevel: number;
  maxLevel: number;
  pendingTargetLevel: number | null;
  nextLevelTitle: string | null;
  nextSkillLevelId: string | null;
  verifiedCount: number;
};

/** Lời mời bước tiếp theo: "Mốc tiếp: Trời gió" + "Xong rồi" (hỏi lại trước khi đánh dấu) và "Nhờ xác nhận" (tùy chọn). */
export function NextMilestoneCard({ s }: { s: SkillLike }) {
  const [done, setDone] = useState(false);
  const flow = useMilestoneFlow((_, on) => setDone(on));
  const target = s.selfLevel + 1;
  const next = milestoneName(s.nextLevelTitle, target);

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
          <span className="truncate text-[13px] text-muted">{s.name}</span>
          <span className="truncate text-[16px] font-bold leading-tight">
            <span className="font-semibold text-accent">Mốc tiếp: </span>
            {next}
          </span>
          <MilestoneBar value={done ? target : s.selfLevel} max={s.maxLevel} verified={s.verifiedCount} showCount />
        </span>
      </Link>
      <div className="flex gap-2">
        <Button
          size="md"
          className="flex-1"
          disabled={flow.pending || done || !s.nextSkillLevelId}
          onClick={() =>
            s.nextSkillLevelId && flow.askCheck({ skillLevelId: s.nextSkillLevelId, level: target, name: next, task: null })
          }
        >
          <Check size={18} strokeWidth={3} className={done ? "tick-pop" : ""} aria-hidden />
          {done ? "Đã xong" : "Xong rồi"}
        </Button>
        {s.pendingTargetLevel === null && s.level < s.maxLevel ? (
          <ButtonLink href={`/proof/new?skill=${s.slug}`} variant="secondary" size="md">
            <Video size={17} aria-hidden />
            Nhờ xác nhận
          </ButtonLink>
        ) : null}
      </div>
      {flow.sheet}
    </section>
  );
}
