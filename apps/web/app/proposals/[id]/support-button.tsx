"use client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, HandHeart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";

/** Ủng hộ đề xuất kỹ năng mới. Chưa có cờ "đã ủng hộ" từ API: lỗi CONFLICT nghĩa là đã ủng hộ. */
export function SupportButton({ proposalId, supported: initial }: { proposalId: string; supported: boolean }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [supported, setSupported] = useState(initial);
  const support = useMutation(
    trpc.proposal.support.mutationOptions({
      onSuccess: () => {
        setSupported(true);
        router.refresh();
      },
      onError: (e) => {
        if (e.data?.code === "CONFLICT") setSupported(true);
      },
    }),
  );
  if (supported) {
    return (
      <p className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-teal">
        <Check size={16} aria-hidden />
        Bạn đã ủng hộ
      </p>
    );
  }
  return (
    <>
      <Button size="md" disabled={support.isPending} onClick={() => support.mutate({ proposalId })}>
        <HandHeart size={18} aria-hidden />
        Ủng hộ
      </Button>
      {support.error && support.error.data?.code !== "CONFLICT" ? (
        <p role="alert" className="text-[13px] text-danger">
          {support.error.message}
        </p>
      ) : null}
    </>
  );
}
