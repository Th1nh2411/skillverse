"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeftRight, CalendarClock, Hourglass, MapPin, Video } from "lucide-react";
import { useId, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";

type Opt = { id: string; name: string };
type Mode = "in_person" | "video";
type Existing = {
  status: "proposed" | "accepted" | "done" | "cancelled";
  role: "proposer" | "receiver";
  mode: Mode;
  scheduledAt: string | null;
  teach: string;
  learn: string;
} | null;

export const MODE_LABEL: Record<Mode, string> = { in_person: "Gặp trực tiếp", video: "Gọi video" };

/**
 * Đề nghị trao đổi kỹ năng. Lưu ý an toàn khi gặp mặt CHỈ hiện sau khi đề nghị được chấp nhận.
 */
export function SwapPanel({
  handle,
  name,
  myTeach,
  theirTeach,
  swap,
}: {
  handle: string;
  name: string;
  myTeach: Opt[];
  theirTeach: Opt[];
  swap: Existing;
}) {
  return (
    <section aria-labelledby="swap" className="mx-5 mt-6 flex flex-col gap-3 border-t border-border pt-5">
      <h2 id="swap" className="flex items-center gap-2 text-[17px] font-bold">
        <ArrowLeftRight size={18} className="text-accent" aria-hidden />
        Trao đổi kỹ năng
      </h2>
      {swap ? <ExistingSwap swap={swap} /> : <ProposeForm handle={handle} name={name} myTeach={myTeach} theirTeach={theirTeach} />}
    </section>
  );
}

function ExistingSwap({ swap }: { swap: NonNullable<Existing> }) {
  const line = (
    <p className="text-[14px] leading-snug">
      {swap.role === "proposer" ? "Bạn dạy" : "Bạn học"} <b className="font-semibold">{swap.teach}</b>
      {", "}
      {swap.role === "proposer" ? "học" : "dạy"} <b className="font-semibold">{swap.learn}</b>
      .<span className="block text-[13px] text-muted">{MODE_LABEL[swap.mode]}</span>
    </p>
  );
  if (swap.status === "proposed") {
    return (
      <div className="flex flex-col gap-3 rounded-[14px] bg-surface p-4">
        {line}
        {swap.role === "proposer" ? (
          <p className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted">
            <Hourglass size={16} aria-hidden />
            Đã gửi, chờ trả lời
          </p>
        ) : (
          <ButtonLink href="/swaps" size="md">
            Trả lời đề nghị
          </ButtonLink>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-teal/40 bg-teal-soft p-4">
      {line}
      {swap.scheduledAt ? (
        <p className="tabular inline-flex items-center gap-1.5 text-[14px] font-semibold text-teal">
          <CalendarClock size={16} aria-hidden />
          {new Date(swap.scheduledAt).toLocaleString("vi-VN", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      ) : null}
      {swap.mode === "in_person" ? (
        <p className="flex items-start gap-2 text-[13px] leading-snug text-text">
          <MapPin size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden />
          Gặp lần đầu ở nơi công cộng. Sau buổi học, cả hai đánh giá nhau.
        </p>
      ) : null}
      <Link href="/swaps" className="-mb-2 inline-flex min-h-11 items-center self-start text-[14px] font-semibold text-accent hover:underline">
        Quản lý trao đổi
      </Link>
    </div>
  );
}

function ProposeForm({ handle, name, myTeach, theirTeach }: { handle: string; name: string; myTeach: Opt[]; theirTeach: Opt[] }) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [teach, setTeach] = useState(myTeach[0]?.id ?? "");
  const [learn, setLearn] = useState(theirTeach[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("video");
  const propose = useMutation(trpc.swap.propose.mutationOptions({ onSuccess: () => router.refresh() }));

  if (myTeach.length === 0 || theirTeach.length === 0) {
    return (
      <p className="text-[14px] text-muted">
        {myTeach.length === 0 ? "Xong ít nhất một mốc để có thể dạy lại." : `${name} chưa xong mốc nào để dạy.`}
      </p>
    );
  }

  const select =
    "min-h-12 w-full rounded-[var(--radius-btn)] border border-border bg-surface px-3 text-[15px] text-text focus:border-accent focus:outline-none";
  const short = name.split(" ").at(-1);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label htmlFor={`${id}-t`} className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
          Bạn dạy
          <select id={`${id}-t`} value={teach} onChange={(e) => setTeach(e.target.value)} className={select}>
            {myTeach.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-l`} className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
          {short} dạy
          <select id={`${id}-l`} value={learn} onChange={(e) => setLearn(e.target.value)} className={select}>
            {theirTeach.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div role="radiogroup" aria-label="Hình thức" className="grid grid-cols-2 gap-2">
        {(["in_person", "video"] as const).map((m) => {
          const on = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMode(m)}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-semibold transition-colors ${
                on ? "bg-text text-bg" : "border border-border text-text hover:bg-surface-2"
              }`}
            >
              {m === "in_person" ? <MapPin size={16} aria-hidden /> : <Video size={16} aria-hidden />}
              {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>
      {propose.error ? (
        <p role="alert" className="text-[14px] text-danger">
          {propose.error.message}
        </p>
      ) : null}
      <Button
        disabled={!teach || !learn || propose.isPending}
        onClick={() => propose.mutate({ receiverHandle: handle, teachSkillId: teach, learnSkillId: learn, mode })}
      >
        {propose.isPending ? "Đang gửi" : "Gửi đề nghị"}
      </Button>
    </div>
  );
}
