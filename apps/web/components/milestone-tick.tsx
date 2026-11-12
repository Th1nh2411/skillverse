"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useTRPC } from "@/lib/trpc";

export type TickState = "verified" | "checked" | "next" | "locked";

/**
 * Gọi milestone.check / uncheck. Trả kết quả hoặc null khi lỗi (đã báo bằng toast, kèm lời nhắn của máy chủ,
 * vd. "Cần xong mốc Đá lửa trước"). Thành công thì làm mới dữ liệu trang (server component + truy vấn client).
 */
export function useMilestoneToggle() {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const check = useMutation(trpc.milestone.check.mutationOptions());
  const uncheck = useMutation(trpc.milestone.uncheck.mutationOptions());

  return {
    pending: check.isPending || uncheck.isPending,
    async toggle(skillLevelId: string, on: boolean, name: string) {
      try {
        const r = await (on ? check : uncheck).mutateAsync({ skillLevelId });
        toast(on ? `Xong mốc ${name}!` : `Đã bỏ đánh dấu ${name}`);
        router.refresh();
        void qc.invalidateQueries();
        return r;
      } catch (e) {
        toast(e instanceof Error && e.message ? e.message : "Chưa lưu được. Thử lại nhé.", "error");
        return null;
      }
    },
  };
}

/**
 * Vòng tròn mốc. Có thể bấm (đánh dấu / bỏ đánh dấu) khi `onToggle` có; vùng chạm 44px.
 * - verified: miếng vải nhỏ có đường khâu (cộng đồng đã công nhận)
 * - checked: dấu ✓ (tự đánh dấu)
 * - next: vòng hổ phách trống, mời bấm
 * - locked: ổ khóa nét đứt
 */
export function TickNode({
  state,
  name,
  onToggle,
  disabled,
  celebrate,
}: {
  state: TickState;
  name: string;
  onToggle?: () => void;
  disabled?: boolean;
  /** Vừa đánh dấu xong: nảy nhẹ (tắt khi prefers-reduced-motion). */
  celebrate?: boolean;
}) {
  const inner = (
    <span
      className={`relative z-10 flex size-8 items-center justify-center rounded-full transition-colors ${
        state === "verified"
          ? "bg-accent-soft text-accent outline-[1.5px] outline-offset-[-4px] outline-dashed outline-accent"
          : state === "checked"
            ? "bg-trail text-bg"
            : state === "next"
              ? "border-2 border-accent bg-bg text-accent"
              : "border-2 border-dashed border-border-strong bg-bg text-muted"
      } ${celebrate ? "tick-pop" : ""}`}
    >
      {state === "verified" || state === "checked" ? (
        <Check size={state === "verified" ? 15 : 18} strokeWidth={3} aria-hidden />
      ) : state === "locked" ? (
        <Lock size={14} aria-hidden />
      ) : null}
      {celebrate ? <span aria-hidden className="tick-burst absolute inset-0 rounded-full" /> : null}
    </span>
  );

  if (!onToggle) {
    const label =
      state === "verified" ? `${name}: đã được công nhận` : state === "checked" ? `${name}: đã xong` : state === "next" ? `${name}: mốc tiếp theo` : `${name}: chưa tới`;
    return (
      <span role="img" aria-label={label} className="flex size-11 shrink-0 items-center justify-center">
        {inner}
      </span>
    );
  }
  const on = state === "checked";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Bỏ đánh dấu mốc ${name}` : `Đánh dấu xong mốc ${name}`}
      disabled={disabled}
      onClick={onToggle}
      className="group flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
    >
      {inner}
    </button>
  );
}
