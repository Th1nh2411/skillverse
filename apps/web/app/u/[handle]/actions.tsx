"use client";
import { useMutation } from "@tanstack/react-query";
import { Check, MessageCircle, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";

export function FollowButton({ handle, initial }: { handle: string; initial: boolean }) {
  const trpc = useTRPC();
  const [on, setOn] = useState(initial);
  const follow = useMutation(trpc.social.follow.mutationOptions({ onError: () => setOn(false) }));
  const unfollow = useMutation(trpc.social.unfollow.mutationOptions({ onError: () => setOn(true) }));
  const busy = follow.isPending || unfollow.isPending;
  return (
    <Button
      size="md"
      className="whitespace-nowrap"
      variant={on ? "secondary" : "primary"}
      aria-pressed={on}
      disabled={busy}
      onClick={() => {
        setOn(!on);
        if (on) unfollow.mutate({ handle });
        else follow.mutate({ handle });
      }}
    >
      {on ? <Check size={18} aria-hidden /> : <UserPlus size={18} aria-hidden />}
      {on ? "Đã theo dõi" : "Theo dõi"}
    </Button>
  );
}

export function MessageButton({ handle }: { handle: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const open = useMutation(trpc.message.open.mutationOptions({ onSuccess: (r) => router.push(`/messages/${r.threadId}`) }));
  return (
    <div className="flex flex-col">
      <Button size="md" variant="secondary" disabled={open.isPending} onClick={() => open.mutate({ handle })}>
        <MessageCircle size={18} aria-hidden />
        Nhắn tin
      </Button>
      {open.error ? (
        <p role="alert" className="pt-1 text-[12px] text-danger">
          {open.error.message}
        </p>
      ) : null}
    </div>
  );
}
