"use client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Flag, PlayCircle, ShieldCheck, X, Zap } from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { REPORT_REASON_LABELS, reportReason, type ReportReasonValue } from "@skillverse/validation";
import { BackButton } from "@/components/ui/back-button";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { InfoSheet, Sheet } from "@/components/ui/sheet";
import { useTRPC } from "@/lib/trpc";
import { formatDuration } from "@/lib/video";
import { ReputationChip } from "../reputation-chip";

type Task = RouterOutputs["review"]["task"];

export function ReviewForm({ task }: { task: Task }) {
  const trpc = useTRPC();
  const submit = useMutation(trpc.review.submit.mutationOptions());
  const [marks, setMarks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((task.myReview?.marks ?? []).map((m) => [m.criterionId, m.met])),
  );
  const [comment, setComment] = useState("");
  const [reported, setReported] = useState(task.reported);

  const marked = task.criteria.filter((c) => marks[c.id] !== undefined).length;
  const allMarked = marked === task.criteria.length;
  const allPass = allMarked && task.criteria.every((c) => marks[c.id]);

  if (submit.isSuccess) {
    return (
      <Done
        title="Đã gửi phiếu. Cảm ơn bạn."
        extra={
          submit.data.xpAwarded > 0 ? (
            <span className="tabular inline-flex items-center gap-1 text-[15px] font-bold text-accent">
              <Zap size={16} aria-hidden />+{submit.data.xpAwarded} XP
            </span>
          ) : null
        }
      />
    );
  }
  if (reported && !task.reported) return <Done title="Đã báo cáo. Biên tập viên sẽ xem." icon="flag" />;

  const closed = !task.canSubmit;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-36">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/review" />
        <h1 className="flex-1 font-display text-[22px] font-extrabold">Duyệt</h1>
        <ReputationChip value={task.reviewerReputation} />
      </header>

      <section className="flex items-start gap-3 px-5 pt-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-[18px] font-bold leading-snug">
            {task.skill.name}{" "}
            <span className="tabular whitespace-nowrap font-semibold text-muted">lên cấp {task.targetLevel}</span>
          </h2>
          <div className="flex items-center gap-1.5 text-[13px] text-muted">
            <ShieldCheck size={15} className="text-teal" aria-hidden />
            <span className="tabular">Ẩn danh {task.anonymousCode}</span>
            <InfoSheet title="Duyệt ẩn danh" label="Cách chọn người duyệt">
              Bạn được chọn ngẫu nhiên. Người nộp ẩn danh, không phải người bạn theo dõi hay từng gặp gần đây. Chỉ chấm theo tiêu
              chí trong video.
            </InfoSheet>
          </div>
        </div>
        <span className="tabular mt-1 shrink-0 text-[13px] text-muted">
          {task.votes}/{task.required} phiếu
        </span>
      </section>

      <div className="relative mx-5 mt-3 overflow-hidden rounded-[var(--radius-card)] bg-black">
        {task.video ? (
          <video src={task.video.url} controls playsInline preload="metadata" className="aspect-video w-full object-contain" />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-surface-2 text-muted">
            <PlayCircle size={44} strokeWidth={1.5} aria-hidden />
            <span className="text-[13px]">Video không còn khả dụng</span>
          </div>
        )}
        {task.durationS ? (
          <span className="tabular pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white">
            {formatDuration(task.durationS)}
          </span>
        ) : null}
      </div>
      {task.caption ? <p className="mx-5 mt-2 text-[14px] leading-snug text-muted">{task.caption}</p> : null}

      <section aria-labelledby="crit" className="mx-5 mt-5 flex flex-col">
        <h2 id="crit" className="pb-1 text-[15px] font-bold">
          Tiêu chí
        </h2>
        {task.criteria.map((c) => {
          const v = marks[c.id];
          return (
            <div
              key={c.id}
              role="group"
              aria-labelledby={`c-${c.id}`}
              className="flex flex-col gap-2 border-b border-border py-3 last:border-0"
            >
              <span id={`c-${c.id}`} className="text-[14px] leading-snug">
                {c.text}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <MarkButton disabled={closed} on={v === true} pass onClick={() => setMarks((m) => ({ ...m, [c.id]: true }))} />
                <MarkButton disabled={closed} on={v === false} onClick={() => setMarks((m) => ({ ...m, [c.id]: false }))} />
              </div>
            </div>
          );
        })}
      </section>

      {!closed ? (
        <>
          <div className="mx-5 mt-4 flex flex-col gap-1.5">
            <label htmlFor="note" className="text-[13px] font-semibold text-muted">
              Nhận xét cho người nộp
            </label>
            <textarea
              id="note"
              rows={2}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Góp ý cụ thể giúp họ tiến bộ"
              className="min-h-[76px] resize-none rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
          </div>
          {!reported ? <ReportButton assignmentId={task.assignmentId} onReported={() => setReported(true)} /> : null}
        </>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[560px] flex-col gap-2 border-t border-border bg-bg px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        {submit.error ? (
          <p role="alert" className="text-[14px] text-danger">
            {submit.error.message || "Gửi phiếu không thành công. Thử lại."}
          </p>
        ) : null}
        {closed ? (
          <p className="flex min-h-[52px] items-center justify-center text-[15px] font-semibold text-muted">
            {task.myReview ? "Bạn đã chấm bằng chứng này" : task.state === "expired" ? "Lượt duyệt đã hết hạn" : "Lượt duyệt đã đóng"}
          </p>
        ) : (
          <Button
            className="w-full"
            variant={allMarked && !allPass ? "danger" : "primary"}
            disabled={!allMarked || submit.isPending}
            onClick={() =>
              submit.mutate({
                assignmentId: task.assignmentId,
                verdict: allPass ? "pass" : "fail",
                marks: task.criteria.map((c) => ({ criterionId: c.id, met: Boolean(marks[c.id]) })),
                comment: comment.trim() || undefined,
              })
            }
          >
            {submit.isPending ? (
              "Đang gửi"
            ) : !allMarked ? (
              <span className="tabular">
                Chấm {marked}/{task.criteria.length} tiêu chí
              </span>
            ) : allPass ? (
              `Xác nhận đạt cấp ${task.targetLevel}`
            ) : (
              "Gửi phiếu chưa đạt"
            )}
          </Button>
        )}
      </div>
    </main>
  );
}

function Done({ title, extra, icon }: { title: string; extra?: React.ReactNode; icon?: "flag" }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 px-5 pt-[18vh]">
      <EmptyState
        icon={icon === "flag" ? Flag : ShieldCheck}
        title={title}
        action={
          <div className="flex flex-col items-center gap-4">
            {extra}
            <ButtonLink href="/review" size="md">
              Duyệt tiếp
            </ButtonLink>
          </div>
        }
      />
    </main>
  );
}

function MarkButton({ on, pass, disabled, onClick }: { on: boolean; pass?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[14px] font-semibold transition-colors disabled:opacity-60 ${
        on
          ? pass
            ? "bg-teal text-bg"
            : "bg-danger text-bg"
          : "border border-border text-text hover:bg-surface-2"
      }`}
    >
      {pass ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
      {pass ? "Đạt" : "Chưa đạt"}
    </button>
  );
}

function ReportButton({ assignmentId, onReported }: { assignmentId: string; onReported: () => void }) {
  const trpc = useTRPC();
  const report = useMutation(
    trpc.review.report.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        onReported();
      },
    }),
  );
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReasonValue | null>(null);
  const [details, setDetails] = useState("");

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="mx-5 mt-3 inline-flex min-h-11 items-center gap-2 self-start rounded-[10px] px-1 text-[14px] font-semibold text-danger"
      >
        <Flag size={16} aria-hidden />
        Báo cáo
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Báo cáo bằng chứng">
        <fieldset className="flex flex-col pt-1">
          <legend className="sr-only">Lý do</legend>
          {reportReason.options.map((r) => (
            <label key={r} className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px] text-text">
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="size-5 accent-[var(--color-danger)]"
              />
              {REPORT_REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>
        <textarea
          aria-label="Mô tả thêm"
          rows={2}
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={reason === "other" ? "Mô tả ngắn" : "Thêm chi tiết (không bắt buộc)"}
          className="mt-2 w-full resize-none rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        {report.error ? (
          <p role="alert" className="pt-2 text-danger">
            {report.error.message || "Gửi không thành công. Thử lại."}
          </p>
        ) : null}
        <Button
          variant="danger"
          className="mt-3 w-full"
          disabled={!reason || (reason === "other" && details.trim().length < 5) || report.isPending}
          onClick={() => reason && report.mutate({ assignmentId, reason, details: details.trim() || undefined })}
        >
          {report.isPending ? "Đang gửi" : "Gửi báo cáo"}
        </Button>
      </Sheet>
    </>
  );
}
