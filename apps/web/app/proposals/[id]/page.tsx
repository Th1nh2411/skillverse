import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Lightbulb, Plus, ShieldAlert, TriangleAlert, Video } from "lucide-react";
import { milestoneName } from "@/lib/milestone";
import { getServerCaller, getViewer } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { CriteriaVote } from "@/components/criteria-vote";
import { ProposalSteps } from "@/components/proposal-steps";
import { BackButton } from "@/components/ui/back-button";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/misc";
import { InfoSheet } from "@/components/ui/sheet";
import { newSkillStep, PROPOSAL_STATUS } from "@/lib/proposal-labels";
import { formatNumber } from "@/lib/skill-visual";
import { timeAgo, timeLeft } from "@/lib/time";
import { Comments } from "./comments";
import { SupportButton } from "./support-button";

export const metadata: Metadata = { title: "Đề xuất" };

type Crit = { text: string };
type NewSkillPayload = { riskLevel?: string; description?: string | null; levels?: { level: number; title?: string | null; description?: string | null; criteria: Crit[] }[] };
type EditPayload = { criteria?: Crit[] };

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await getServerCaller();
  const [p, viewer] = await Promise.all([orNotFound(api.proposal.get({ proposalId: id })), getViewer()]);
  const st = PROPOSAL_STATUS[p.status];
  const isAuthor = viewer?.handle === p.author.handle;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-12">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/proposals" />
        <span className="text-[14px] font-semibold text-muted">
          {p.kind === "new_skill" ? "Đề xuất kỹ năng mới" : "Góp ý mốc"}
        </span>
      </header>

      <section className="flex flex-col gap-1.5 px-5 pt-2">
        <h1 className="font-display text-[26px] font-extrabold leading-tight">{p.title}</h1>
        <p className="text-[13px] text-muted">
          <Link href={`/u/${p.author.handle}`} className="font-semibold text-text hover:underline">
            {p.author.displayName}
          </Link>{" "}
          đề xuất {timeAgo(p.createdAt)}
        </p>
        <p className={`text-[14px] font-semibold ${st.tone}`}>{st.label}</p>
      </section>

      {p.kind === "new_skill" ? <NewSkillBody p={p} isAuthor={isAuthor} /> : <EditBody p={p} />}

      {p.rationale ? (
        <section className="mx-5 mt-5 flex flex-col gap-1">
          <h2 className="text-[13px] font-semibold text-muted">Lý do</h2>
          <p className="text-[15px] leading-relaxed">{p.rationale}</p>
        </section>
      ) : null}

      <Comments proposalId={p.id} count={p.commentCount} />
    </main>
  );
}

type Detail = Awaited<ReturnType<Awaited<ReturnType<typeof getServerCaller>>["proposal"]["get"]>>;

function NewSkillBody({ p, isAuthor }: { p: Detail; isAuthor: boolean }) {
  const payload = p.payload as NewSkillPayload;
  const step = newSkillStep(p.status);
  const need = p.supportNeeded ?? 0;
  return (
    <>
      <section aria-label="Tiến trình" className="mx-5 mt-5 flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
        <div className="flex items-center gap-1">
          <ProposalSteps current={step.current} failed={step.failed} />
          <InfoSheet title="Đề xuất kỹ năng mới" label="Cách đề xuất được mở">
            Cần {formatNumber(need)} người ủng hộ{p.supportRule ? ` trong ${p.supportRule.days} ngày` : " trước hạn"}. Đủ thì biên tập viên kiểm tra an toàn và tiêu chí, rồi mở kỹ năng cho
            mọi người. Người đề xuất là người ủng hộ đầu tiên.
          </InfoSheet>
        </div>
        {p.status === "gathering" ? (
          <>
            <ProgressBar value={p.supportCount} max={Math.max(need, 1)} label="Số người ủng hộ" />
            <div className="tabular flex items-center justify-between text-[13px] text-muted">
              <span>
                <b className="font-bold text-text">{formatNumber(p.supportCount)}</b>/{formatNumber(need)} người ủng hộ
              </span>
              {p.votingEndsAt ? (
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} aria-hidden />
                  {timeLeft(p.votingEndsAt)}
                </span>
              ) : null}
            </div>
            <SupportButton proposalId={p.id} supported={p.mySupport || isAuthor} />
          </>
        ) : p.status === "accepted" && p.createdSkillSlug ? (
          <ButtonLink href={`/skills/${p.createdSkillSlug}`} size="md" variant="secondary">
            Xem kỹ năng
            <ArrowRight size={16} aria-hidden />
          </ButtonLink>
        ) : null}
      </section>

      {payload.riskLevel && payload.riskLevel !== "none" ? (
        <p className="mx-5 mt-4 inline-flex items-center gap-1.5 self-start rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent">
          {payload.riskLevel === "high" ? <ShieldAlert size={15} aria-hidden /> : <TriangleAlert size={15} aria-hidden />}
          {payload.riskLevel === "high" ? "Rủi ro cao" : "Cần cẩn thận"}
        </p>
      ) : null}
      {payload.description ? <p className="mx-5 mt-4 text-[15px] leading-relaxed">{payload.description}</p> : null}

      {payload.levels?.length ? (
        <section aria-labelledby="levels" className="mx-5 mt-5 flex flex-col gap-2">
          <h2 id="levels" className="text-[15px] font-bold">
            Các mốc
          </h2>
          <ol className="flex flex-col">
            {payload.levels.map((l) => (
              <li key={l.level} className="flex gap-3 border-b border-border py-2.5 last:border-0">
                <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong font-display text-[13px] font-extrabold text-muted">
                  {l.level}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[15px] font-bold leading-snug">{milestoneName(l.title, l.level)}</span>
                  {l.criteria.map((c, i) => (
                    <span key={i} className="flex items-start gap-1.5 text-[14px] leading-snug">
                      <Video size={14} className="mt-[3px] shrink-0 text-accent" aria-hidden />
                      {c.text}
                    </span>
                  ))}
                  {l.description ? (
                    <span className="flex items-start gap-1.5 text-[13px] leading-snug text-muted">
                      <Lightbulb size={14} className="mt-[2px] shrink-0" aria-label="Cách làm" />
                      {l.description}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}

function EditBody({ p }: { p: Detail }) {
  const next = (p.payload as EditPayload).criteria ?? [];
  const open = p.status === "voting" || p.status === "gathering";
  return (
    <>
      {p.skill ? (
        <Link
          href={`/skills/${p.skill.slug}`}
          className="mx-5 mt-3 self-start text-[14px] font-semibold text-accent hover:underline"
        >
          {p.skill.name}
          {p.targetLevel ? `: mốc ${milestoneName(p.levelTitle, p.targetLevel)}` : ""}
        </Link>
      ) : null}
      <section aria-label="So sánh" className="mx-5 mt-4 grid gap-3">
        {p.currentCriteria ? (
          <div className="flex flex-col gap-1.5 rounded-[14px] border border-border p-3.5">
            <h2 className="text-[12px] font-semibold text-muted">Hiện tại</h2>
            <ul className="flex flex-col gap-1 text-[14px] leading-snug text-muted">
              {p.currentCriteria.map((c) => (
                <li key={c.position}>{c.text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5 rounded-[14px] border border-teal/40 bg-teal-soft p-3.5">
          <h2 className="text-[12px] font-semibold text-teal">Đề xuất</h2>
          <ul className="flex flex-col gap-1 text-[14px] leading-snug">
            {next.map((c, i) => {
              const added = !p.currentCriteria?.some((o) => o.text.trim() === c.text.trim());
              return (
                <li key={i} className={added ? "flex items-start gap-1.5 font-semibold text-teal" : "pl-[21px]"}>
                  {added ? <Plus size={15} className="mt-0.5 shrink-0" aria-label="Mới" /> : null}
                  {c.text}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      {p.rule && p.tally ? (
        <section aria-label="Bỏ phiếu" className="mx-5 mt-5">
          <CriteriaVote
            proposalId={p.id}
            rule={p.rule}
            tally={p.tally}
            myVote={p.myVote}
            myWeight={p.myWeight}
            open={open}
          />
          {open && p.votingEndsAt ? (
            <p className="tabular mt-2 inline-flex items-center gap-1 text-[13px] text-muted">
              <Clock size={13} aria-hidden />
              {timeLeft(p.votingEndsAt)}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
