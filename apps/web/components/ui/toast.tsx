"use client";
import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Tone = "ok" | "error";
type Action = { label: string; onClick: () => void };
type Toast = { id: number; text: string; tone: Tone; action?: Action };

const Ctx = createContext<(text: string, tone?: Tone, action?: Action) => void>(() => undefined);

/** Thông báo ngắn nổi phía trên (tự ẩn sau 3,5 giây). Dùng cho phản hồi thao tác nhanh: đánh dấu mốc, lưu. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (text: string, tone: Tone = "ok", action?: Action) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, text, tone, action }]);
      // Có nút hành động (vd. "Hoàn tác") thì giữ lâu hơn để kịp bấm.
      setTimeout(() => dismiss(id), action ? 5500 : 3500);
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-50 mx-auto flex max-w-[560px] flex-col items-center gap-2 px-5"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`animate-fade-in pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-[14px] border px-4 py-2.5 text-[14px] font-semibold shadow-[0_6px_20px_rgba(0,0,0,0.25)] ${
              t.tone === "error" ? "border-danger/50 bg-surface-2 text-text" : "border-border bg-surface-2 text-text"
            }`}
          >
            {t.tone === "error" ? (
              <CircleAlert size={18} className="mt-px shrink-0 text-danger" aria-hidden />
            ) : (
              <CircleCheck size={18} className="mt-px shrink-0 text-teal" aria-hidden />
            )}
            <span className="min-w-0">{t.text}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  t.action!.onClick();
                }}
                className="-my-2 -mr-2 ml-1 inline-flex min-h-11 shrink-0 items-center rounded-[10px] px-3 font-bold text-accent hover:bg-surface-3"
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
