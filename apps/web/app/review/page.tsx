import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clock, ShieldCheck } from "lucide-react";
import { NotebookArt } from "@/components/illustrations";
import { milestoneName } from "@/lib/milestone";
import { getServerCaller } from "@/lib/server/trpc";
import { patchOf } from "@/lib/skill-visual";
import { BackButton } from "@/components/ui/back-button";
import { LevelPatch } from "@/components/ui/level-patch";
import { EmptyState } from "@/components/ui/misc";
import { ReputationChip } from "./reputation-chip";

export const metadata: Metadata = { title: "Cần duyệt" };

function dueLabel(due: Date) {
  const h = Math.round((due.getTime() - Date.now()) / 3_600_000);
  return h <= 0 ? "Sắp hết hạn" : `Còn ${h} giờ`;
}

export default async function ReviewQueuePage() {
  const api = await getServerCaller();
  const q = await api.review.queue();
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/home" />
        <h1 className="flex-1 font-display text-[22px] font-extrabold">Cần duyệt</h1>
        <ReputationChip value={q.reputation} />
      </header>

      {q.items.length === 0 ? (
        <div className="px-5 pt-4">
          <EmptyState art={<NotebookArt size={150} />} title="Chưa có video nào cần bạn duyệt" />
        </div>
      ) : (
        <ul className="flex flex-col pt-3">
          {q.items.map((it) => {
            const urgent = it.dueAt.getTime() - Date.now() < 6 * 3_600_000;
            const patch = patchOf(it.skill);
            return (
              <li key={it.assignmentId}>
                <Link
                  href={`/review/${it.assignmentId}`}
                  className="flex min-h-16 items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-surface active:bg-surface-2"
                >
                  <LevelPatch
                    categorySlug={patch.categorySlug}
                    rarity={patch.rarity}
                    state="practicing"
                    icon={patch.icon}
                    size={48}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] text-muted">{it.skill.name}</span>
                    <span className="truncate text-[15px] font-semibold">
                      <span className="sr-only">Mốc </span>
                      {milestoneName(it.levelTitle, it.targetLevel)}
                    </span>
                    <span className="tabular inline-flex items-center gap-1 text-[12px] text-muted">
                      <ShieldCheck size={13} className="text-teal" aria-hidden />
                      {it.votes}/{it.required}
                      <span className="sr-only">phiếu</span>
                    </span>
                  </span>
                  <span
                    className={`tabular inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold ${urgent ? "text-accent" : "text-muted"}`}
                  >
                    <Clock size={13} aria-hidden />
                    {dueLabel(it.dueAt)}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
