"use client";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { useState } from "react";
import { REPORT_REASON_LABELS, reportReason, type ReportReasonValue } from "@skillverse/validation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useTRPC } from "@/lib/trpc";

type Target = "proof" | "user" | "review" | "post" | "skill";

/** Nút "Báo cáo" mở sheet chọn lý do. `compact`: chỉ biểu tượng (cần `label`). */
export function ReportSheet({
  targetType,
  targetId,
  title = "Báo cáo",
  compact,
  label = "Báo cáo",
}: {
  targetType: Target;
  targetId: string;
  title?: string;
  compact?: boolean;
  label?: string;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReasonValue | null>(null);
  const [details, setDetails] = useState("");
  const report = useMutation(trpc.report.create.mutationOptions());

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={compact ? label : undefined}
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex size-11 items-center justify-center rounded-[12px] text-muted hover:bg-surface-2 hover:text-danger"
            : "inline-flex min-h-11 items-center gap-2 rounded-[12px] px-2 text-[14px] font-semibold text-danger hover:bg-surface-2"
        }
      >
        <Flag size={compact ? 18 : 16} aria-hidden />
        {compact ? null : label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {report.isSuccess ? (
          <p role="status" className="py-4 text-[15px] text-text">
            Đã gửi. Biên tập viên sẽ xem.
          </p>
        ) : (
          <>
            <fieldset className="flex flex-col pt-1">
              <legend className="sr-only">Lý do</legend>
              {reportReason.options.map((r) => (
                <label key={r} className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px] text-text">
                  <input
                    type="radio"
                    name={`reason-${targetId}`}
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
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Thêm chi tiết (không bắt buộc)"
              className="mt-2 w-full resize-none rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
            {report.error ? (
              <p role="alert" className="pt-2 text-danger">
                {report.error.message}
              </p>
            ) : null}
            <Button
              variant="danger"
              className="mt-3 w-full"
              disabled={!reason || report.isPending}
              onClick={() => reason && report.mutate({ targetType, targetId, reason, details: details.trim() || undefined })}
            >
              {report.isPending ? "Đang gửi" : "Gửi báo cáo"}
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}
