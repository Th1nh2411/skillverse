"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useTRPC } from "@/lib/trpc";

type Target = "post" | "skill" | "proof";

/** Nút "Lưu" (chỉ biểu tượng, có aria-label). Bật/tắt lạc quan; lỗi thì trả lại và báo bằng toast. */
export function SaveButton({
  targetType,
  targetId,
  saved: initial,
  className = "",
  size = 20,
}: {
  targetType: Target;
  targetId: string;
  saved: boolean;
  className?: string;
  size?: number;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const toggle = useMutation(
    trpc.save.toggle.mutationOptions({
      onSuccess: (r) => {
        setSaved(r.saved);
        toast(r.saved ? "Đã lưu" : "Đã bỏ lưu");
        void qc.invalidateQueries({ queryKey: trpc.save.list.pathKey() });
      },
      onError: (e) => {
        setSaved((s) => !s);
        toast(e.message || "Chưa lưu được. Thử lại nhé.", "error");
      },
    }),
  );
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Bỏ lưu" : "Lưu"}
      disabled={toggle.isPending}
      onClick={() => {
        setSaved((s) => !s);
        toggle.mutate({ targetType, targetId });
      }}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] transition-colors hover:bg-surface-2 ${
        saved ? "text-accent" : "text-muted"
      } ${className}`}
    >
      <Icon size={size} strokeWidth={2} aria-hidden fill={saved ? "currentColor" : "none"} fillOpacity={saved ? 0.18 : 0} />
    </button>
  );
}
