"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Lock, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useTRPC } from "@/lib/trpc";

export type TickState = "verified" | "checked" | "next" | "locked";

/**
 * Gọi milestone.check / uncheck. Trả kết quả hoặc null khi lỗi (đã báo bằng toast, kèm lời nhắn của máy chủ,
 * vd. "Cần xong mốc Đá lửa trước"). Đánh dấu xong thì toast có nút "Hoàn tác" (~5 giây).
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
    async toggle(skillLevelId: string, on: boolean, name: string, opts: { undo?: () => void; undone?: boolean } = {}) {
      try {
        const r = await (on ? check : uncheck).mutateAsync({ skillLevelId });
        if (on) toast(`Xong mốc ${name}!`, "ok", opts.undo ? { label: "Hoàn tác", onClick: opts.undo } : undefined);
        else toast(opts.undone ? "Đã hoàn tác" : `Đã bỏ đánh dấu ${name}`);
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

export type MilestoneTarget = { skillLevelId: string; level: number; name: string; task: string | null };
type Ask = { mode: "check" | "uncheck" | "verified"; t: MilestoneTarget };

/**
 * Luồng đánh dấu có xác nhận: hỏi trước khi đánh dấu ("Xong mốc Trời gió?"), toast "Hoàn tác" sau khi đánh dấu,
 * hỏi trước khi bỏ đánh dấu; mốc đã xác nhận chỉ giải thích (không bỏ được).
 * `onLocal(level, checked)` để màn hình cập nhật lạc quan; lỗi thì gọi lại với giá trị cũ.
 */
export function useMilestoneFlow(onLocal?: (level: number, checked: boolean) => void) {
  const { toggle, pending } = useMilestoneToggle();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [celebrate, setCelebrate] = useState<number | null>(null);

  async function doUncheck(t: MilestoneTarget, undone = false) {
    onLocal?.(t.level, false);
    setCelebrate(null);
    const r = await toggle(t.skillLevelId, false, t.name, { undone });
    if (!r) onLocal?.(t.level, true);
  }
  async function doCheck(t: MilestoneTarget) {
    onLocal?.(t.level, true);
    setCelebrate(t.level);
    const r = await toggle(t.skillLevelId, true, t.name, { undo: () => void doUncheck(t, true) });
    if (!r) {
      onLocal?.(t.level, false);
      setCelebrate(null);
    }
  }

  const close = () => setAsk(null);
  let body: ReactNode = null;
  let title = "";
  if (ask?.mode === "check") {
    title = `Xong mốc ${ask.t.name}?`;
    body = (
      <>
        {ask.t.task ? (
          <p className="flex items-start gap-2 pt-1 text-[15px] font-semibold leading-snug text-text">
            <Video size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            {ask.t.task}
          </p>
        ) : null}
        <p className="pt-2">Tự đánh dấu để theo dõi tiến độ, không cần video.</p>
        <div className="grid grid-cols-2 gap-2.5 pt-4">
          <Button variant="secondary" onClick={close}>
            Chưa
          </Button>
          <Button
            onClick={() => {
              const t = ask.t;
              close();
              void doCheck(t);
            }}
          >
            <Check size={18} strokeWidth={3} aria-hidden />
            Xong rồi
          </Button>
        </div>
      </>
    );
  } else if (ask?.mode === "uncheck") {
    title = `Bỏ đánh dấu ${ask.t.name}?`;
    body = (
      <>
        <p className="pt-1">Mốc này sẽ về trạng thái chưa xong. Bạn có thể đánh dấu lại bất cứ lúc nào.</p>
        <div className="grid grid-cols-2 gap-2.5 pt-4">
          <Button variant="secondary" onClick={close}>
            Giữ
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const t = ask.t;
              close();
              void doUncheck(t);
            }}
          >
            Bỏ đánh dấu
          </Button>
        </div>
      </>
    );
  } else if (ask?.mode === "verified") {
    title = ask.t.name;
    body = (
      <>
        <p className="flex items-start gap-2 pt-1 text-[15px] leading-snug text-text">
          <BadgeCheck size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>
            <b className="font-semibold">Đã xác nhận.</b> Cộng đồng đã xem video và công nhận mốc này.
          </span>
        </p>
        <Button variant="secondary" className="mt-4 w-full" onClick={close}>
          Đóng
        </Button>
      </>
    );
  }

  return {
    pending,
    celebrate,
    askCheck: (t: MilestoneTarget) => setAsk({ mode: "check", t }),
    askUncheck: (t: MilestoneTarget) => setAsk({ mode: "uncheck", t }),
    showVerified: (t: MilestoneTarget) => setAsk({ mode: "verified", t }),
    sheet: (
      <Sheet open={ask !== null} onClose={close} title={title || "Mốc"}>
        {body}
      </Sheet>
    ),
  };
}

/** Dấu đã xác nhận: miếng vải hổ phách có đường khâu (dùng trong hàng mốc, chú giải, hồ sơ). */
export function VerifiedMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative flex shrink-0 items-center justify-center rounded-full bg-accent text-on-accent outline-[1.5px] outline-offset-[-4px] outline-dashed outline-on-accent/70"
      style={{ width: size, height: size }}
    >
      <Check size={Math.round(size * 0.5)} strokeWidth={3.2} />
    </span>
  );
}

/** Dấu tự đánh dấu: viền ✓ nhạt. */
export function SelfMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-bg text-muted"
      style={{ width: size, height: size }}
    >
      <Check size={Math.round(size * 0.5)} strokeWidth={3} />
    </span>
  );
}

/** Nhãn ngắn dưới tên mốc: "Đã xác nhận" / "Tự đánh dấu". */
export function MarkLabel({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent">
      <BadgeCheck size={14} aria-hidden />
      Đã xác nhận
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted">
      <Check size={13} strokeWidth={3} aria-hidden />
      Tự đánh dấu
    </span>
  );
}

/**
 * Vòng tròn mốc, vùng chạm 44px. Bấm được khi có `onPress`.
 * - verified: miếng vải hổ phách có đường khâu (cộng đồng đã xác nhận)
 * - checked: viền ✓ nhạt (tự đánh dấu)
 * - next: vòng hổ phách trống, mời bấm
 * - locked: ổ khóa nét đứt
 */
export function TickNode({
  state,
  name,
  onPress,
  disabled,
  celebrate,
}: {
  state: TickState;
  name: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Vừa đánh dấu xong: nảy nhẹ (tắt khi prefers-reduced-motion). */
  celebrate?: boolean;
}) {
  const inner =
    state === "verified" ? (
      <VerifiedMark />
    ) : state === "checked" ? (
      <span className={`relative ${celebrate ? "tick-pop" : ""}`}>
        <SelfMark />
        {celebrate ? <span aria-hidden className="tick-burst absolute inset-0 rounded-full" /> : null}
      </span>
    ) : (
      <span
        className={`relative flex size-8 items-center justify-center rounded-full ${
          state === "next" ? "border-2 border-accent bg-bg text-accent" : "border-2 border-dashed border-border-strong bg-bg text-muted"
        }`}
      >
        {state === "locked" ? <Lock size={14} aria-hidden /> : null}
      </span>
    );

  const label =
    state === "verified"
      ? `${name}: đã xác nhận`
      : state === "checked"
        ? onPress
          ? `Bỏ đánh dấu mốc ${name}`
          : `${name}: tự đánh dấu`
        : state === "next"
          ? onPress
            ? `Đánh dấu xong mốc ${name}`
            : `${name}: mốc tiếp theo`
          : `${name}: chưa tới`;

  if (!onPress) {
    return (
      <span role="img" aria-label={label} className="flex size-11 shrink-0 items-center justify-center">
        {inner}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={state === "checked" || state === "verified"}
      aria-label={label}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onPress}
      className="flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
    >
      {inner}
    </button>
  );
}
