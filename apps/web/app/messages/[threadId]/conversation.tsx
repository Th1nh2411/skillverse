"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { clockTime } from "@/lib/time";
import { useTRPC } from "@/lib/trpc";

export function Conversation({
  threadId,
  other,
}: {
  threadId: string;
  other: { handle: string; displayName: string; avatarUrl: string | null };
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery({ ...trpc.message.list.queryOptions({ threadId }), refetchInterval: 15_000 });
  const [body, setBody] = useState("");
  const send = useMutation(
    trpc.message.send.mutationOptions({
      onSuccess: () => {
        setBody("");
        void qc.invalidateQueries({ queryKey: trpc.message.list.queryKey({ threadId }) });
      },
    }),
  );
  const items = list.data?.items ?? [];
  const canSend = list.data?.canSend ?? true;

  return (
    <main className="mx-auto flex h-dvh max-w-[560px] flex-col">
      <header className="flex items-center gap-1 border-b border-border px-3 py-2">
        <BackButton fallback="/messages" />
        <Link href={`/u/${other.handle}`} className="flex min-w-0 items-center gap-2.5 rounded-[12px] py-1 pr-2">
          <Avatar name={other.displayName} size={34} />
          <h1 className="truncate text-[16px] font-bold">{other.displayName}</h1>
        </Link>
      </header>

      {/* Tin mới nhất trước → flex-col-reverse để tin mới ở dưới, cuộn bắt đầu từ dưới */}
      <ol aria-label="Tin nhắn" aria-live="polite" className="flex flex-1 flex-col-reverse gap-1.5 overflow-y-auto px-4 py-3">
        {list.isPending ? (
          <li>
            <Skeleton className="h-10 w-2/3" />
          </li>
        ) : items.length === 0 ? (
          <li className="py-8 text-center text-[14px] text-muted">Gửi lời chào đầu tiên.</li>
        ) : (
          items.map((m) => (
            <li key={m.id} className={`flex max-w-[80%] flex-col ${m.mine ? "items-end self-end" : "items-start self-start"}`}>
              <span
                className={`whitespace-pre-line rounded-[16px] px-3.5 py-2 text-[15px] leading-snug ${
                  m.mine ? "rounded-br-[6px] bg-accent text-on-accent" : "rounded-bl-[6px] bg-surface-2 text-text"
                }`}
              >
                {m.body}
              </span>
              <time className="tabular px-1 pt-0.5 text-[11px] text-muted" dateTime={m.createdAt.toISOString()}>
                {clockTime(m.createdAt)}
              </time>
            </li>
          ))
        )}
      </ol>

      {canSend ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) send.mutate({ threadId, body: body.trim() });
          }}
          className="flex items-end gap-2 border-t border-border px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5"
        >
          <textarea
            aria-label="Tin nhắn"
            rows={1}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Nhắn tin"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface px-4 py-2.5 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Gửi"
            disabled={!body.trim() || send.isPending}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
          >
            <Send size={19} aria-hidden />
          </button>
        </form>
      ) : (
        <p className="border-t border-border px-5 pb-[max(env(safe-area-inset-bottom),14px)] pt-3 text-center text-[14px] text-muted">
          Tài khoản của bạn đang bị hạn chế, chưa gửi được tin nhắn.
        </p>
      )}
      {send.error ? (
        <p role="alert" className="px-5 pb-2 text-[13px] text-danger">
          {send.error.message}
        </p>
      ) : null}
    </main>
  );
}
