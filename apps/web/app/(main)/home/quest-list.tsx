"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronRight } from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { useTRPC } from "@/lib/trpc";

type Quest = RouterOutputs["home"]["quests"]["quests"][number];

/** Nhiệm vụ nào dẫn tới đâu; nhiệm vụ tự báo (luyện tập) có nút "Xong". */
const QUEST_HREF: Record<string, string> = {
  review_2: "/review",
  suggest_criteria: "/proposals?kind=edit_criteria",
};
const SELF_REPORTED = new Set(["practice_10min"]);

export function QuestList({ quests }: { quests: Quest[] }) {
  return (
    <ul className="mt-1 flex flex-col">
      {quests.map((q) => (
        <QuestRow key={q.key} q={q} />
      ))}
    </ul>
  );
}

function QuestRow({ q }: { q: Quest }) {
  const trpc = useTRPC();
  const router = useRouter();
  const progress = useMutation(trpc.home.questProgress.mutationOptions({ onSuccess: () => router.refresh() }));
  const href = QUEST_HREF[q.key];

  const body = (
    <>
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          q.done ? "bg-accent text-on-accent" : "border-2 border-dashed border-border-strong"
        }`}
        aria-hidden
      >
        {q.done ? <Check size={16} strokeWidth={3} /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[15px] leading-snug ${q.done ? "text-muted line-through decoration-border-strong" : "font-semibold"}`}>
          {q.title}
        </span>
        {!q.done && q.target > 1 ? (
          <span className="tabular text-[12px] text-muted">
            {q.progress}/{q.target}
          </span>
        ) : null}
      </span>
      <span className={`tabular shrink-0 text-[13px] font-bold ${q.done ? "text-muted" : "text-accent"}`}>+{q.xp} XP</span>
    </>
  );

  const row = "flex min-h-14 items-center gap-3 py-2";
  return (
    <li className="border-b border-border last:border-0">
      {q.done ? (
        <div className={row}>
          {body}
          <span className="sr-only">, đã xong</span>
        </div>
      ) : href ? (
        <Link href={href} className={`${row} -mx-2 rounded-[12px] px-2 hover:bg-surface`}>
          {body}
          <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
        </Link>
      ) : SELF_REPORTED.has(q.key) ? (
        <div className={row}>
          {body}
          <button
            type="button"
            disabled={progress.isPending}
            onClick={() => progress.mutate({ questKey: q.key })}
            className="min-h-11 shrink-0 rounded-[10px] border border-border px-3 text-[13px] font-semibold hover:bg-surface-2 disabled:opacity-50"
          >
            Xong
          </button>
        </div>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}
