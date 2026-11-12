"use client";
import { Info, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bottom sheet dùng <dialog> gốc: có sẵn bẫy focus, Esc để đóng, trả focus về nút mở.
 * Chạm ra vùng tối bên ngoài để đóng.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const openedAt = useRef(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      openedAt.current = performance.now();
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // Bỏ qua chạm vào nền ngay khi sheet đang trượt lên (tránh đóng nhầm khi bấm nút đúng lúc mở).
        if (e.target === e.currentTarget && performance.now() - openedAt.current > 350) onClose();
      }}
      className="m-0 mt-auto h-auto max-h-[85dvh] w-full max-w-none bg-transparent p-0 text-text backdrop:bg-black/60 open:flex open:justify-center"
    >
      <div className="animate-sheet-in w-full max-w-[560px] rounded-t-[22px] border-t border-border bg-surface-2 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">
        <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-border-strong" aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-[12px] text-muted hover:bg-surface-3"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="pb-2 text-[14px] leading-relaxed text-muted">{children}</div>
      </div>
    </dialog>
  );
}

/** Nút ⓘ mở bottom sheet chứa luật lệ hệ thống (progressive disclosure). */
export function InfoSheet({ title, label, children }: { title: string; label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label ?? `Cách hoạt động: ${title}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="-m-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-text"
      >
        <Info size={18} strokeWidth={2} aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Sheet>
    </>
  );
}
