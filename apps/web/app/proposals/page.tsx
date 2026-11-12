import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lightbulb, MessageCircle, Plus, Users } from "lucide-react";
import { getServerCaller } from "@/lib/server/trpc";
import { BackButton } from "@/components/ui/back-button";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PROPOSAL_STATUS } from "@/lib/proposal-labels";
import { milestoneName } from "@/lib/milestone";
import { formatNumber } from "@/lib/skill-visual";

export const metadata: Metadata = { title: "Đề xuất của cộng đồng" };

const TABS = [
  { kind: "new_skill", label: "Kỹ năng mới" },
  { kind: "edit_criteria", label: "Góp ý mốc" },
] as const;

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ kind?: string; skill?: string }> }) {
  const sp = await searchParams;
  const kind = sp.kind === "edit_criteria" ? "edit_criteria" : "new_skill";
  const api = await getServerCaller();
  const { items } = await api.proposal.list({ kind, skillSlug: sp.skill || undefined });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-10">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/discover" />
        <h1 className="flex-1 font-display text-[22px] font-extrabold">Đề xuất</h1>
        <Link
          href="/skills/propose"
          className="inline-flex min-h-11 items-center gap-1 rounded-[12px] px-2 text-[14px] font-semibold text-accent hover:bg-surface-2"
        >
          <Plus size={18} aria-hidden />
          Kỹ năng mới
        </Link>
      </header>

      <nav aria-label="Loại đề xuất" className="mx-5 mt-2 grid grid-cols-2 border-b border-border">
        {TABS.map((t) => {
          const on = t.kind === kind;
          return (
            <Link
              key={t.kind}
              href={t.kind === "new_skill" ? "/proposals" : "/proposals?kind=edit_criteria"}
              aria-current={on ? "page" : undefined}
              className={`-mb-px inline-flex min-h-12 items-center justify-center border-b-2 text-[14px] font-semibold ${
                on ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <div className="px-5 pt-4">
          <EmptyState
            icon={Lightbulb}
            title={kind === "new_skill" ? "Chưa có đề xuất kỹ năng nào" : "Chưa có góp ý mốc nào"}
            action={
              kind === "new_skill" ? (
                <ButtonLink href="/skills/propose" size="md">
                  Đề xuất kỹ năng
                </ButtonLink>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col pt-1">
          {items.map((p) => {
            const st = PROPOSAL_STATUS[p.status];
            return (
              <li key={p.id} className="border-b border-border last:border-0">
                <Link href={`/proposals/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{p.title}</span>
                    {p.skill ? (
                      <span className="truncate text-[13px] text-muted">
                        {p.skill.name}
                        {p.targetLevel ? `: mốc ${milestoneName(p.levelTitle, p.targetLevel)}` : ""}
                      </span>
                    ) : null}
                    <span className="tabular flex items-center gap-3 text-[12px]">
                      <span className={`font-semibold ${st.tone}`}>{st.label}</span>
                      {p.kind === "new_skill" && p.supportNeeded ? (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <Users size={12} aria-hidden />
                          {formatNumber(p.supportCount)}/{formatNumber(p.supportNeeded)}
                          <span className="sr-only">người ủng hộ</span>
                        </span>
                      ) : p.tally?.agreeRatio != null ? (
                        <span className="text-muted">{Math.round(p.tally.agreeRatio * 100)}% đồng ý</span>
                      ) : null}
                      {p.commentCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <MessageCircle size={12} aria-hidden />
                          {p.commentCount}
                          <span className="sr-only">bình luận</span>
                        </span>
                      ) : null}
                    </span>
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
