"use client";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Video } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { MilestoneBar } from "@/components/ui/milestone";
import { useMilestoneToggle } from "@/components/milestone-tick";
import { useToast } from "@/components/ui/toast";
import { milestoneName } from "@/lib/milestone";
import { skillIcon, type Rarity } from "@/lib/skill-visual";
import { useTRPC } from "@/lib/trpc";

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
};


/** Lời mời bước tiếp theo: "Mốc tiếp: Trời gió" + "Xong rồi" (tự đánh dấu) và "Nhờ xác nhận" (tùy chọn). */
export function NextMilestoneCard({ s }: { s: SkillLike }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { toggle, pending } = useMilestoneToggle();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const target = s.selfLevel + 1;
  const next = milestoneName(s.nextLevelTitle, target);

  async function tick() {
    setBusy(true);
    setDone(true);
    try {
      // Hồ sơ chưa trả skillLevelId của mốc kế tiếp → lấy từ chi tiết kỹ năng (có cache).
      const d = await qc.fetchQuery(trpc.skill.detail.queryOptions({ slug: s.slug }));
      const id = d.nextMilestone?.level === target ? d.nextMilestone.skillLevelId : null;
      const r = id ? await toggle(id, true, next) : null;
      if (!id) toast("Mốc này vừa đổi. Tải lại trang nhé.", "error");
      if (!r) setDone(false);
    } catch (e) {
      setDone(false);
      toast(e instanceof Error && e.message ? e.message : "Chưa lưu được. Thử lại nhé.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Mốc tiếp theo"
      className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-3.5 outline outline-1 outline-accent-line"
    >
      <div className="flex items-center gap-3">
        <Link href={`/skills/${s.slug}`} aria-label={s.name} className="shrink-0">
          <LevelPatch
            categorySlug={s.category.slug}
            rarity={s.rarity}
            state={s.level > 0 ? "earned" : "practicing"}
            icon={skillIcon(s.slug, s.category.slug)}
            size={48}
          />
        </Link>
        <Link href={`/skills/${s.slug}`} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[13px] text-muted">{s.name}</span>
          <span className="truncate text-[16px] font-bold leading-tight">
            <span className="font-semibold text-accent">Mốc tiếp: </span>
            {next}
          </span>
          <MilestoneBar value={done ? target : s.selfLevel} max={s.maxLevel} showCount />
        </Link>
      </div>
      <div className="flex gap-2">
        <Button size="md" className="flex-1" disabled={busy || pending || done} onClick={tick}>
          <Check size={18} strokeWidth={3} className={done ? "tick-pop" : ""} aria-hidden />
          {done ? "Đã xong" : "Xong rồi"}
        </Button>
        {s.pendingTargetLevel === null ? (
          <ButtonLink href={`/proof/new?skill=${s.slug}`} variant="secondary" size="md">
            <Video size={17} aria-hidden />
            Nhờ xác nhận
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}
