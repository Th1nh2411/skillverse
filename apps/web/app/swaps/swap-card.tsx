"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CalendarClock, MapPin, Star } from "lucide-react";
import { useId, useState } from "react";
import type { RouterOutputs } from "@skillverse/api";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useTRPC } from "@/lib/trpc";
import { MODE_LABEL } from "../u/[handle]/swap-panel";

type Swap = Omit<RouterOutputs["swap"]["list"][number], "scheduledAt" | "createdAt"> & { scheduledAt: string | null };

const STATUS: Record<Swap["status"], string> = {
  proposed: "Chờ trả lời",
  accepted: "Đã nhận lời",
  done: "Đã học xong",
  cancelled: "Đã hủy",
};

export function SwapCard({ swap }: { swap: Swap }) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [when, setWhen] = useState("");
  const [stars, setStars] = useState(0);
  const done = { onSuccess: () => router.refresh() };
  const respond = useMutation(trpc.swap.respond.mutationOptions(done));
  const rate = useMutation(trpc.swap.rate.mutationOptions(done));
  const error = respond.error ?? rate.error;
  const busy = respond.isPending || rate.isPending;
  const act = (action: "accept" | "decline" | "cancel" | "complete") =>
    respond.mutate({ swapId: swap.id, action, scheduledAt: action === "accept" && when ? new Date(when) : undefined });

  const proposer = swap.role === "proposer";
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      <div className="flex items-center gap-3">
        <Link href={`/u/${swap.other.handle}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={swap.other.displayName} size={36} />
          <span className="truncate text-[15px] font-semibold">{swap.other.displayName}</span>
        </Link>
        <span className="shrink-0 text-[12px] font-semibold text-muted">{STATUS[swap.status]}</span>
      </div>
      <p className="text-[14px] leading-snug">
        {proposer ? "Bạn dạy" : "Bạn học"} <b className="font-semibold">{swap.teachSkill.name}</b>, {proposer ? "học" : "dạy"}{" "}
        <b className="font-semibold">{swap.learnSkill.name}</b>.
        <span className="block text-[13px] text-muted">{MODE_LABEL[swap.mode]}</span>
      </p>

      {swap.status === "accepted" ? (
        <>
          {swap.scheduledAt ? (
            <p className="tabular inline-flex items-center gap-1.5 text-[14px] font-semibold text-teal">
              <CalendarClock size={16} aria-hidden />
              {new Date(swap.scheduledAt).toLocaleString("vi-VN", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : null}
          {swap.mode === "in_person" ? (
            <p className="flex items-start gap-2 text-[13px] leading-snug">
              <MapPin size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden />
              Gặp lần đầu ở nơi công cộng. Sau buổi học, cả hai đánh giá nhau.
            </p>
          ) : null}
        </>
      ) : null}

      {swap.status === "proposed" && !proposer ? (
        <div className="flex flex-col gap-2.5">
          <label htmlFor={`${id}-when`} className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            Hẹn lúc (không bắt buộc)
            <input
              id={`${id}-when`}
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="min-h-12 rounded-[var(--radius-btn)] border border-border bg-bg px-3 text-[15px] text-text [color-scheme:dark] focus:border-accent focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button size="md" variant="secondary" disabled={busy} onClick={() => act("decline")}>
              Từ chối
            </Button>
            <Button size="md" disabled={busy} onClick={() => act("accept")}>
              Nhận lời
            </Button>
          </div>
        </div>
      ) : swap.status === "proposed" ? (
        <Button size="sm" variant="ghost" className="self-start border border-border" disabled={busy} onClick={() => act("cancel")}>
          Hủy đề nghị
        </Button>
      ) : swap.status === "accepted" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button size="md" variant="secondary" disabled={busy} onClick={() => act("cancel")}>
            Hủy
          </Button>
          <Button size="md" disabled={busy} onClick={() => act("complete")}>
            Đã học xong
          </Button>
        </div>
      ) : swap.status === "done" && swap.canRate ? (
        <div className="flex items-center gap-3">
          <div role="radiogroup" aria-label="Đánh giá" className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} sao`}
                onClick={() => setStars(n)}
                className="inline-flex size-11 items-center justify-center"
              >
                <Star size={22} className={n <= stars ? "fill-accent text-accent" : "text-border-strong"} aria-hidden />
              </button>
            ))}
          </div>
          <Button size="sm" disabled={!stars || busy} onClick={() => rate.mutate({ swapId: swap.id, stars })}>
            Gửi
          </Button>
        </div>
      ) : swap.myRating ? (
        <p className="tabular inline-flex items-center gap-1 text-[13px] text-muted">
          <Star size={14} className="fill-accent text-accent" aria-hidden />
          Bạn chấm {swap.myRating}/5
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error.message}
        </p>
      ) : null}
    </li>
  );
}
