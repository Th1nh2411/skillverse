"use client";
import { Check, ChevronRight, Hourglass, Lightbulb, Lock, Video } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { MilestoneBar } from "@/components/ui/milestone";
import { MilestoneRulesInfo } from "@/components/milestone-rules";
import { TickNode, useMilestoneToggle, type TickState } from "@/components/milestone-tick";
import { SummitArt } from "@/components/illustrations";
import { milestoneName } from "@/lib/milestone";

export type TrailLevel = {
  skillLevelId: string;
  level: number;
  title: string | null;
  task: string | null;
  description: string | null;
  xpReward: number;
  checked: boolean;
  verified: boolean;
};

/** Tiến độ = mốc cao nhất L mà mọi mốc 1..L đã tự đánh dấu hoặc đã được công nhận (khớp domain). */
function selfLevelOf(levels: TrailLevel[], checked: Set<number>): number {
  let l = 0;
  for (const lv of levels) {
    if (lv.verified || checked.has(lv.level)) l = lv.level;
    else break;
  }
  return l;
}

/**
 * Đường mốc của một kỹ năng: bấm vòng tròn để tự đánh dấu (✓), mốc đã được công nhận có đường khâu.
 * Mốc kế tiếp mở sẵn: "Xong rồi" (chính) và "Nhờ xác nhận" (tùy chọn, quay video).
 */
export function MilestoneTrail({
  slug,
  categorySlug,
  levels,
  verifiedLevel,
  pendingProofId,
  prerequisitesMet,
  reviewers,
  reviewerTitle,
}: {
  slug: string;
  categorySlug: string;
  levels: TrailLevel[];
  verifiedLevel: number;
  pendingProofId: string | null;
  prerequisitesMet: boolean | null;
  reviewers: number;
  reviewerTitle: string | null;
}) {
  const [checked, setChecked] = useState(() => new Set(levels.filter((l) => l.checked).map((l) => l.level)));
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const { toggle, pending } = useMilestoneToggle();
  const self = selfLevelOf(levels, checked);
  const max = levels.length;
  const verifyLevel = verifiedLevel + 1 <= max ? verifiedLevel + 1 : null;
  const locked = prerequisitesMet === false;

  async function run(lv: TrailLevel, on: boolean) {
    const name = milestoneName(lv.title, lv.level);
    const prev = new Set(checked);
    const next = new Set(checked);
    if (on) next.add(lv.level);
    else next.delete(lv.level);
    setChecked(next);
    setCelebrate(on ? lv.level : null);
    const r = await toggle(lv.skillLevelId, on, name);
    if (!r) {
      setChecked(prev);
      setCelebrate(null);
    }
  }

  const verifyAction = (compact: boolean) =>
    pendingProofId ? (
      <ButtonLink href={`/proofs/${pendingProofId}`} variant="ghost" size="sm" className={compact ? "-ml-3 self-start" : ""}>
        <Hourglass size={16} aria-hidden />
        Chờ duyệt
      </ButtonLink>
    ) : (
      <ButtonLink
        href={`/proof/new?skill=${slug}`}
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "sm" : "md"}
        className={compact ? "-ml-3 self-start text-accent" : "flex-1"}
      >
        <Video size={17} aria-hidden />
        Nhờ xác nhận
      </ButtonLink>
    );

  return (
    <section aria-labelledby="milestones" className="mt-6 flex flex-col">
      <div className="flex items-center gap-3 px-5">
        <h2 id="milestones" className="text-[17px] font-bold">
          {max} mốc
        </h2>
        <MilestoneBar value={self} max={max} showCount className="flex-1" />
      </div>

      <ol className="mt-2 flex flex-col px-3">
        {levels.map((lv, i) => {
          const name = milestoneName(lv.title, lv.level);
          const state: TickState = lv.verified
            ? "verified"
            : checked.has(lv.level)
              ? "checked"
              : lv.level === self + 1
                ? "next"
                : "locked";
          const canCheck = state === "next" && !locked;
          const canUncheck = state === "checked" && lv.level === self;
          const last = i === levels.length - 1;
          const isNext = state === "next";

          const head = (
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={`text-[16px] font-bold leading-snug ${state === "locked" ? "text-muted" : "text-text"}`}>{name}</span>
              {lv.task ? (
                <span className={`line-clamp-2 text-[14px] leading-snug ${isNext ? "text-text" : "text-muted"}`}>{lv.task}</span>
              ) : null}
            </span>
          );

          return (
            <li key={lv.level} className="flex gap-1">
              <span className="relative flex w-11 shrink-0 flex-col items-center self-stretch">
                <span className="relative mt-1">
                  <TickNode
                    state={state}
                    name={name}
                    celebrate={celebrate === lv.level}
                    disabled={pending}
                    onToggle={canCheck ? () => run(lv, true) : canUncheck ? () => run(lv, false) : undefined}
                  />
                </span>
                {!last ? (
                  <span
                    aria-hidden
                    className={`-mb-1 flex-1 border-l-2 ${
                      state === "verified" || state === "checked" ? "border-trail/70" : "border-dashed border-border-strong"
                    }`}
                  />
                ) : null}
              </span>

              {isNext ? (
                <div className="mb-3 mt-1 flex min-w-0 flex-1 flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-3.5 outline outline-1 outline-accent-line">
                  {head}
                  {lv.description ? (
                    <p className="flex items-start gap-2 text-[14px] leading-relaxed text-muted">
                      <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-label="Cách làm" />
                      <span>{lv.description}</span>
                    </p>
                  ) : null}
                  {locked ? (
                    <ButtonLink href={`/skills/tree/${categorySlug}`} variant="secondary" size="md" className="w-full">
                      <Lock size={17} aria-hidden />
                      Xem điều kiện
                    </ButtonLink>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button size="md" className="w-full" disabled={pending} onClick={() => run(lv, true)}>
                        <Check size={18} strokeWidth={3} aria-hidden />
                        Xong rồi
                      </Button>
                      {verifyLevel === lv.level ? (
                        <div className="flex items-center gap-1">
                          {verifyAction(false)}
                          <span className="tabular shrink-0 px-1 text-[13px] font-bold text-accent">+{lv.xpReward} XP</span>
                          <MilestoneRulesInfo reviewers={reviewers} reviewerTitle={reviewerTitle} />
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-1 flex min-w-0 flex-1 flex-col">
                  {lv.description ? (
                    <details className="group">
                      <summary className="flex min-h-14 cursor-pointer list-none items-start gap-2 rounded-[12px] px-1 py-2 hover:bg-surface [&::-webkit-details-marker]:hidden">
                        {head}
                        <ChevronRight
                          size={18}
                          className="mt-1 shrink-0 text-muted transition-transform group-open:rotate-90"
                          aria-label="Cách làm"
                        />
                      </summary>
                      <p className="flex items-start gap-2 px-1 pb-2 text-[14px] leading-relaxed text-muted">
                        <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden />
                        <span>{lv.description}</span>
                      </p>
                    </details>
                  ) : (
                    <div className="flex min-h-14 px-1 py-2">{head}</div>
                  )}
                  {verifyLevel === lv.level && state === "checked" ? (
                    <div className="flex items-center px-1 pb-1">
                      {verifyAction(true)}
                      <MilestoneRulesInfo reviewers={reviewers} reviewerTitle={reviewerTitle} />
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {self >= max ? (
        <div className="mx-5 mt-4 flex items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-border px-4 py-3">
          <SummitArt size={84} className="shrink-0 text-muted" />
          <p className="text-[15px] font-semibold">Xong cả {max} mốc. Giỏi quá!</p>
        </div>
      ) : null}
    </section>
  );
}
