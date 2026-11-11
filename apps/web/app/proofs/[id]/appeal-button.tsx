"use client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useTRPC } from "@/lib/trpc";

const MIN = 10;

export function AppealButton({ proofId, deadline }: { proofId: string; deadline: string | null }) {
  const trpc = useTRPC();
  const appeal = useMutation(trpc.proof.appeal.mutationOptions({ onSuccess: () => setOpen(false) }));
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (appeal.isSuccess) {
    return (
      <p role="status" className="flex flex-1 items-center justify-center text-[14px] font-semibold text-muted">
        Đã gửi kháng nghị
      </p>
    );
  }

  const days = deadline ? Math.max(1, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)) : null;
  return (
    <>
      <Button variant="secondary" className="flex-1" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Kháng nghị
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Kháng nghị">
        <div className="flex flex-col gap-3 pt-1">
          <p>
            Biên tập viên xem lại; nếu hợp lý, bằng chứng được người khác duyệt lại. Mỗi bằng chứng kháng nghị một lần
            {days ? <span className="tabular">, còn {days} ngày</span> : null}.
          </p>
          <textarea
            aria-label="Lý do kháng nghị"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vì sao bạn nghĩ kết quả chưa đúng?"
            className="resize-none rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
          {appeal.error ? (
            <p role="alert" className="text-danger">
              {appeal.error.message || "Gửi không thành công. Thử lại."}
            </p>
          ) : null}
          <Button
            disabled={reason.trim().length < MIN || appeal.isPending}
            onClick={() => appeal.mutate({ proofId, reason: reason.trim() })}
          >
            {appeal.isPending ? "Đang gửi" : "Gửi kháng nghị"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
