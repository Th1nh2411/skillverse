"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";
import { Avatar, QueryError } from "@/components/ui/misc";
import { timeAgo } from "@/lib/time";
import { useTRPC } from "@/lib/trpc";

export function Comments({ proposalId, count }: { proposalId: string; count: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery(trpc.proposal.comments.queryOptions({ proposalId }));
  const [body, setBody] = useState("");
  const send = useMutation(
    trpc.proposal.comment.mutationOptions({
      onSuccess: () => {
        setBody("");
        void qc.invalidateQueries({ queryKey: trpc.proposal.comments.queryKey({ proposalId }) });
      },
    }),
  );
  const items = list.data?.items ?? [];

  return (
    <section aria-labelledby="comments" className="mx-5 mt-6 flex flex-col gap-3 border-t border-border pt-5">
      <h2 id="comments" className="tabular text-[15px] font-bold">
        Bình luận{count > 0 ? ` (${count})` : ""}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate({ proposalId, body: body.trim() });
        }}
        className="flex items-end gap-2"
      >
        <textarea
          aria-label="Bình luận"
          rows={1}
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Góp ý của bạn"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface px-4 py-2.5 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Gửi bình luận"
          disabled={!body.trim() || send.isPending}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
        >
          <Send size={18} aria-hidden />
        </button>
      </form>
      {send.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {send.error.message}
        </p>
      ) : null}
      {list.error ? <QueryError onRetry={() => list.refetch()} message="Không tải được bình luận." /> : null}
      <ul className="flex flex-col gap-3">
        {items.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar name={c.author.displayName} size={32} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[13px]">
                <Link href={`/u/${c.author.handle}`} className="font-semibold hover:underline">
                  {c.author.displayName}
                </Link>{" "}
                <span className="text-muted">{timeAgo(c.createdAt)}</span>
              </p>
              <p className="whitespace-pre-line text-[14px] leading-snug">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
