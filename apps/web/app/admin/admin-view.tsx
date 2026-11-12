"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Copy, Flag, Inbox, Lightbulb, Scale } from "lucide-react";
import { useId, useState } from "react";
import type { RouterOutputs } from "@skillverse/api";
import {
  MILESTONE_DESCRIPTION_MAX,
  MILESTONE_TITLE_MAX,
  REPORT_REASON_LABELS,
  SANCTION_KIND_LABELS,
  sanctionKindInput,
} from "@skillverse/validation";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton, QueryError } from "@/components/ui/misc";
import { timeAgo } from "@/lib/time";
import { milestoneName } from "@/lib/milestone";
import { useTRPC } from "@/lib/trpc";

type Tab = "reports" | "disputed" | "appeals" | "proposals" | "milestones";
type Report = RouterOutputs["admin"]["reports"]["items"][number];
type Disputed = RouterOutputs["admin"]["disputedProofs"][number];
type Appeal = RouterOutputs["admin"]["appeals"][number];
type SkillProposal = RouterOutputs["admin"]["proposals"]["items"][number];

const TARGET_LABEL: Record<Report["targetType"], string> = {
  proof: "Bằng chứng",
  user: "Người dùng",
  review: "Phiếu duyệt",
  post: "Bài viết",
  skill: "Kỹ năng",
};

const ACTION_LABEL = {
  level_revoked: "Đã thu hồi mốc",
  proof_removed: "Đã gỡ bằng chứng",
  post_hidden: "Đã ẩn bài viết",
} as const;

const card = "flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4";
const input =
  "w-full rounded-[var(--radius-btn)] border border-border bg-bg px-3 py-2.5 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none";

export function AdminView({ initialTab }: { initialTab: Tab }) {
  const id = useId();
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabs: { key: Tab; label: string }[] = [
    { key: "reports", label: "Báo cáo" },
    { key: "disputed", label: "Trùng video" },
    { key: "appeals", label: "Kháng nghị" },
    { key: "proposals", label: "Đề xuất" },
    { key: "milestones", label: "Mốc" },
  ];
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-10">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/profile" />
        <h1 className="font-display text-[22px] font-extrabold">Quản trị</h1>
      </header>
      <div role="tablist" aria-label="Hàng đợi" className="no-scrollbar mx-5 mt-2 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            id={`${id}-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`${id}-panel`}
            onClick={() => setTab(t.key)}
            className={`-mb-px min-h-12 shrink-0 whitespace-nowrap border-b-2 px-3 text-[14px] font-semibold ${
              tab === t.key ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="flex flex-col gap-3 px-5 pt-4">
        {tab === "reports" ? <Reports /> : tab === "disputed" ? <DisputedList /> : tab === "appeals" ? <Appeals /> : tab === "proposals" ? <SkillProposals /> : <Milestones />}
      </div>
    </main>
  );
}

function Loading() {
  return (
    <>
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </>
  );
}

function Reports() {
  const trpc = useTRPC();
  const q = useQuery(trpc.admin.reports.queryOptions({}));
  if (q.isPending) return <Loading />;
  if (q.error) return <QueryError onRetry={() => q.refetch()} />;
  if (!q.data?.items.length) return <EmptyState icon={Inbox} title="Không có báo cáo nào đang mở" />;
  return (
    <ul className="flex flex-col gap-3">
      {q.data.items.map((r) => (
        <ReportCard key={r.id} r={r} />
      ))}
    </ul>
  );
}

function ReportCard({ r }: { r: Report }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.admin.reports.queryKey() });
  const resolve = useMutation(trpc.admin.resolveReport.mutationOptions());
  const revokes = r.targetType === "proof" && r.target.proofStatus === "passed";

  if (resolve.data) {
    return (
      <li className={card}>
        <p className="text-[14px] font-semibold">
          {resolve.data.status === "confirmed" ? "Đã xác nhận" : "Đã bác bỏ"}
          {resolve.data.action ? `, ${ACTION_LABEL[resolve.data.action].toLowerCase()}` : ""}
        </p>
        <Button size="sm" variant="ghost" className="self-start border border-border" onClick={refresh}>
          Làm mới danh sách
        </Button>
      </li>
    );
  }

  return (
    <li className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[12px] font-semibold text-muted">
            {TARGET_LABEL[r.targetType]}
            {r.target.ownerHandle ? (
              <>
                {" của "}
                <Link href={`/u/${r.target.ownerHandle}`} className="hover:underline">
                  @{r.target.ownerHandle}
                </Link>
              </>
            ) : null}
          </p>
          <h2 className="text-[15px] font-bold leading-snug">{r.target.title}</h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[12px] font-bold text-danger">
          <Flag size={12} aria-hidden />
          {REPORT_REASON_LABELS[r.reason]}
        </span>
      </div>
      {r.details ? <p className="text-[14px] leading-snug">{r.details}</p> : null}
      <p className="tabular text-[12px] text-muted">
        @{r.reporter.handle} báo cáo {timeAgo(r.createdAt)}
        {r.openReportsOnTarget > 1 ? `, cùng ${r.openReportsOnTarget - 1} báo cáo khác` : ""}
      </p>
      <input
        aria-label="Kết luận (ghi chú)"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        placeholder="Kết luận (không bắt buộc)"
        className={input}
      />
      {revokes ? <p className="text-[13px] text-accent">Xác nhận sẽ thu hồi mốc của bằng chứng này.</p> : null}
      {resolve.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {resolve.error.message}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="md"
          variant="secondary"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate({ reportId: r.id, decision: "dismissed", outcome: outcome.trim() || undefined })}
        >
          Bác bỏ
        </Button>
        <Button
          size="md"
          variant="danger"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate({ reportId: r.id, decision: "confirmed", outcome: outcome.trim() || undefined })}
        >
          Xác nhận
        </Button>
      </div>
      {r.target.ownerId ? <SanctionForm userId={r.target.ownerId} reportId={r.id} /> : null}
    </li>
  );
}

function SanctionForm({ userId, reportId }: { userId: string; reportId: string }) {
  const trpc = useTRPC();
  const id = useId();
  const [kind, setKind] = useState<(typeof sanctionKindInput.options)[number]>("warning");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const sanction = useMutation(trpc.admin.sanction.mutationOptions());
  if (sanction.isSuccess) return <p className="text-[13px] font-semibold text-teal">Đã áp dụng: {SANCTION_KIND_LABELS[kind]}</p>;
  return (
    <details className="rounded-[12px] border border-border px-3 py-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
        Xử phạt người dùng
      </summary>
      <div className="flex flex-col gap-2 pb-3">
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <select aria-label="Hình thức" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={input}>
            {sanctionKindInput.options.map((k) => (
              <option key={k} value={k}>
                {SANCTION_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          {kind !== "warning" ? (
            <label htmlFor={`${id}-d`} className="relative">
              <span className="sr-only">Số ngày</span>
              <input
                id={`${id}-d`}
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className={`${input} pr-10`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">ngày</span>
            </label>
          ) : null}
        </div>
        <input aria-label="Lý do xử phạt" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do" className={input} />
        {sanction.error ? (
          <p role="alert" className="text-[13px] text-danger">
            {sanction.error.message}
          </p>
        ) : null}
        <Button
          size="md"
          variant="danger"
          disabled={reason.trim().length < 3 || sanction.isPending}
          onClick={() =>
            sanction.mutate({
              userId,
              kind,
              reason: reason.trim(),
              durationDays: kind === "warning" ? undefined : Number(days) || undefined,
              reportId,
            })
          }
        >
          Áp dụng
        </Button>
      </div>
    </details>
  );
}

function DisputedList() {
  const trpc = useTRPC();
  const q = useQuery(trpc.admin.disputedProofs.queryOptions());
  if (q.isPending) return <Loading />;
  if (q.error) return <QueryError onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyState icon={Copy} title="Không có video trùng nào cần xem" />;
  return (
    <ul className="flex flex-col gap-3">
      {q.data.map((d) => (
        <DisputedCard key={d.proofId} d={d} />
      ))}
    </ul>
  );
}

function DisputedCard({ d }: { d: Disputed }) {
  const trpc = useTRPC();
  const resolve = useMutation(trpc.admin.resolveDisputedProof.mutationOptions());
  return (
    <li className={card}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-bold">
          {d.skill.name} <span className="text-muted">mốc {milestoneName(d.levelTitle, d.targetLevel)}</span>
        </h2>
        <p className="text-[13px] text-muted">
          <Link href={`/u/${d.user.handle}`} className="hover:underline">
            {d.user.displayName}
          </Link>{" "}
          nộp {timeAgo(d.createdAt)}
        </p>
      </div>
      <video src={d.video.url} controls playsInline preload="metadata" className="aspect-video w-full rounded-[12px] bg-black" />
      {d.matches.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-semibold text-muted">Trùng với</p>
          <ul className="flex flex-col gap-0.5 text-[13px]">
            {d.matches.map((m) => (
              <li key={m.proofId}>
                @{m.userHandle}, {m.skillName} <span className="text-muted">({m.status})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {resolve.isSuccess ? (
        <p className="text-[14px] font-semibold text-teal">Đã xử lý</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button size="md" variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate({ proofId: d.proofId, decision: "clear" })}>
            Hợp lệ, cho duyệt
          </Button>
          <Button size="md" variant="danger" disabled={resolve.isPending} onClick={() => resolve.mutate({ proofId: d.proofId, decision: "remove" })}>
            Gỡ bằng chứng
          </Button>
        </div>
      )}
      {resolve.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {resolve.error.message}
        </p>
      ) : null}
    </li>
  );
}

function Appeals() {
  const trpc = useTRPC();
  const q = useQuery(trpc.admin.appeals.queryOptions());
  if (q.isPending) return <Loading />;
  if (q.error) return <QueryError onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyState icon={Scale} title="Không có kháng nghị nào đang mở" />;
  return (
    <ul className="flex flex-col gap-3">
      {q.data.map((a) => (
        <AppealCard key={a.appealId} a={a} />
      ))}
    </ul>
  );
}

function AppealCard({ a }: { a: Appeal }) {
  const trpc = useTRPC();
  const resolve = useMutation(trpc.admin.resolveAppeal.mutationOptions());
  return (
    <li className={card}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-bold">
          {a.proof.skill.name} <span className="text-muted">mốc {milestoneName(a.proof.levelTitle, a.proof.targetLevel)}</span>
        </h2>
        <p className="tabular text-[13px] text-muted">
          <Link href={`/u/${a.user.handle}`} className="hover:underline">
            {a.user.displayName}
          </Link>{" "}
          kháng nghị {timeAgo(a.createdAt)}, {a.proof.passVotes}/{a.proof.totalVotes} phiếu đạt
        </p>
      </div>
      <p className="rounded-[12px] bg-bg px-3 py-2.5 text-[14px] leading-snug">{a.reason}</p>
      {resolve.data ? (
        <p className="text-[14px] font-semibold text-teal">
          {resolve.data.status === "overturned" ? "Đã chấp nhận, mở vòng duyệt mới" : "Đã giữ nguyên kết quả"}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button size="md" variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate({ appealId: a.appealId, decision: "upheld" })}>
            Giữ kết quả
          </Button>
          <Button size="md" disabled={resolve.isPending} onClick={() => resolve.mutate({ appealId: a.appealId, decision: "overturned" })}>
            Duyệt lại
          </Button>
        </div>
      )}
      {resolve.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {resolve.error.message}
        </p>
      ) : null}
    </li>
  );
}

function SkillProposals() {
  const trpc = useTRPC();
  const q = useQuery(trpc.admin.proposals.queryOptions());
  if (q.isPending) return <Loading />;
  if (q.error) return <QueryError onRetry={() => q.refetch()} />;
  if (!q.data?.items.length) return <EmptyState icon={Lightbulb} title="Không có đề xuất kỹ năng nào chờ biên tập" />;
  return (
    <ul className="flex flex-col gap-3">
      {q.data.items.map((p) => (
        <ProposalCard key={p.id} p={p} />
      ))}
    </ul>
  );
}

function ProposalCard({ p }: { p: SkillProposal }) {
  const trpc = useTRPC();
  const [note, setNote] = useState("");
  const decide = useMutation(trpc.admin.decideProposal.mutationOptions());
  return (
    <li className={card}>
      <Link href={`/proposals/${p.id}`} className="flex items-start gap-2 hover:underline">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-[15px] font-bold leading-snug">{p.title}</h2>
          <span className="tabular text-[13px] font-normal text-muted">
            {p.author.displayName}, {p.supportCount} người ủng hộ
          </span>
        </span>
        <ChevronRight size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
      </Link>
      {decide.data ? (
        <p className="text-[14px] font-semibold text-teal">
          {decide.data.status === "accepted" ? "Đã mở kỹ năng" : "Đã từ chối"}
          {decide.data.skillSlug ? (
            <>
              {" "}
              <Link href={`/skills/${decide.data.skillSlug}`} className="text-accent underline">
                Xem
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <>
          <input
            aria-label="Ghi chú cho người đề xuất"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú (không bắt buộc)"
            className={input}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="md"
              variant="secondary"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ proposalId: p.id, decision: "rejected", note: note.trim() || undefined })}
            >
              Từ chối
            </Button>
            <Button
              size="md"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ proposalId: p.id, decision: "accepted", note: note.trim() || undefined })}
            >
              Mở kỹ năng
            </Button>
          </div>
        </>
      )}
      {decide.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {decide.error.message}
        </p>
      ) : null}
    </li>
  );
}

/** Biên tập viên sửa tên / hướng dẫn từng mốc (không đụng việc cần làm: sửa qua góp ý + bỏ phiếu). */
function Milestones() {
  const trpc = useTRPC();
  const [q, setQ] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const search = useQuery({ ...trpc.skill.search.queryOptions({ query: q.trim(), limit: 8 }), enabled: q.trim().length > 0 });
  const detail = useQuery({ ...trpc.skill.detail.queryOptions({ slug: slug ?? "" }), enabled: !!slug });

  return (
    <>
      <input
        type="search"
        aria-label="Tìm kỹ năng"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSlug(null);
        }}
        placeholder="Tìm kỹ năng để sửa mốc"
        className={input}
      />
      {!slug && search.data ? (
        <ul className="flex flex-col">
          {search.data.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSlug(s.slug)}
                className="flex min-h-11 w-full items-center justify-between rounded-[10px] px-2 text-left text-[15px] font-semibold hover:bg-surface"
              >
                {s.name}
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {slug && detail.isPending ? <Loading /> : null}
      {detail.error ? <QueryError onRetry={() => detail.refetch()} /> : null}
      {slug && detail.data ? (
        <ol className="flex flex-col gap-3">
          {detail.data.levels.map((l) => (
            <MilestoneEditor key={l.skillLevelId} lv={l} />
          ))}
        </ol>
      ) : null}
    </>
  );
}

function MilestoneEditor({
  lv,
}: {
  lv: { skillLevelId: string; level: number; title: string | null; description: string | null; task: string | null };
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [title, setTitle] = useState(lv.title ?? "");
  const [desc, setDesc] = useState(lv.description ?? "");
  const save = useMutation(
    trpc.admin.updateMilestone.mutationOptions({ onSuccess: () => qc.invalidateQueries({ queryKey: trpc.skill.detail.pathKey() }) }),
  );
  const changed = title.trim() !== (lv.title ?? "") || desc.trim() !== (lv.description ?? "");
  return (
    <li className={card}>
      <label className="flex flex-col gap-1">
        <span className="tabular text-[12px] font-semibold text-muted">Mốc {lv.level}</span>
        <input value={title} maxLength={MILESTONE_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} className={input} />
      </label>
      {lv.task ? <p className="text-[13px] text-muted">{lv.task}</p> : null}
      <textarea
        aria-label={`Cách làm mốc ${lv.level}`}
        rows={3}
        value={desc}
        maxLength={MILESTONE_DESCRIPTION_MAX}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Cách làm (không bắt buộc)"
        className={`${input} resize-none`}
      />
      <div className="flex items-center gap-3">
        <Button
          size="md"
          disabled={!changed || title.trim().length === 0 || save.isPending}
          onClick={() =>
            save.mutate({
              skillLevelId: lv.skillLevelId,
              title: title.trim() !== (lv.title ?? "") ? title.trim() : undefined,
              description: desc.trim() !== (lv.description ?? "") ? desc.trim() || null : undefined,
            })
          }
        >
          {save.isPending ? "Đang lưu" : "Lưu"}
        </Button>
        {save.isSuccess && !changed ? <span className="text-[13px] font-semibold text-teal">Đã lưu</span> : null}
        {save.error ? (
          <span role="alert" className="text-[13px] text-danger">
            {save.error.message}
          </span>
        ) : null}
      </div>
    </li>
  );
}
