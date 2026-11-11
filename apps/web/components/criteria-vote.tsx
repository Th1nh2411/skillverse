"use client";
import { useMutation } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { useState } from "react";
import { ProgressBar } from "@/components/ui/misc";
import { InfoSheet } from "@/components/ui/sheet";
import { formatNumber } from "@/lib/skill-visual";
import { useTRPC } from "@/lib/trpc";

type Rule = { agree_ratio: number; min_votes: number; voter_min_level: number };
type Tally = { agreeRatio: number | null; weightedVoteCount: number; voteCount: number };

/**
 * Bỏ phiếu đề xuất sửa tiêu chí: Đồng ý / Không đồng ý, tỉ lệ có trọng số, luật trong ⓘ.
 * Ngưỡng đọc từ `rule` (app_config.criteria_change_rule) do API trả về.
 */
export function CriteriaVote({
  proposalId,
  rule,
  tally: initial,
  myVote: initialVote,
  myWeight: initialWeight,
  open,
}: {
  proposalId: string;
  rule: Rule;
  tally: Tally;
  /** VoteValue của DB ("support" là phiếu ủng hộ kỹ năng mới, không dùng ở đây). */
  myVote: "support" | "agree" | "disagree" | null;
  myWeight?: number | null;
  open: boolean;
}) {
  const trpc = useTRPC();
  const [tally, setTally] = useState(initial);
  const [myVote, setMyVote] = useState<string | null>(initialVote);
  const [myWeight, setMyWeight] = useState(initialWeight ?? null);
  const vote = useMutation(
    trpc.proposal.vote.mutationOptions({
      onSuccess: (r) => {
        setTally({ agreeRatio: r.agreeRatio, weightedVoteCount: r.weightedVoteCount, voteCount: r.voteCount });
        setMyVote(r.myVote);
        setMyWeight(r.myWeight);
      },
    }),
  );
  const pct = Math.round((tally.agreeRatio ?? 0) * 100);
  const need = Math.round(rule.agree_ratio * 100);

  return (
    <div className="flex flex-col gap-2.5">
      <ProgressBar value={pct} max={100} tone="teal" label="Tỉ lệ đồng ý có trọng số" />
      <div className="tabular flex items-center justify-between text-[13px] text-muted">
        <span className="inline-flex items-center gap-1">
          <b className="font-bold text-teal">{tally.agreeRatio === null ? "Chưa có phiếu" : `${pct}% đồng ý`}</b>
          <InfoSheet title="Sửa tiêu chí" label="Cách thông qua góp ý">
            Thông qua khi đạt {need}% đồng ý và có ít nhất {rule.min_votes} phiếu được tính. Chỉ phiếu của người đạt cấp{" "}
            {rule.voter_min_level} trở lên kỹ năng này được tính; người cấp cao hơn có trọng số lớn hơn. Tiêu chí mới áp dụng cho
            bằng chứng nộp sau đó.
          </InfoSheet>
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={13} aria-hidden />
          {formatNumber(tally.weightedVoteCount)}/{formatNumber(rule.min_votes)}
          <span className="sr-only">phiếu được tính trên số phiếu tối thiểu</span>
        </span>
      </div>
      {open ? (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["agree", "Đồng ý", ThumbsUp],
              ["disagree", "Không đồng ý", ThumbsDown],
            ] as const
          ).map(([v, label, Icon]) => {
            const on = myVote === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                disabled={vote.isPending}
                onClick={() => vote.mutate({ proposalId, vote: v })}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-semibold transition-colors disabled:opacity-60 ${
                  on
                    ? v === "agree"
                      ? "bg-teal text-bg"
                      : "bg-surface-3 text-text outline outline-1 outline-border-strong"
                    : "border border-border text-text hover:bg-surface-2"
                }`}
              >
                <Icon size={16} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
      {myVote && myWeight === 0 ? (
        <p className="text-[13px] leading-snug text-muted">
          Phiếu của bạn được ghi nhận nhưng chưa được tính vì bạn chưa đạt cấp {rule.voter_min_level}.
        </p>
      ) : null}
      {vote.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {vote.error.message}
        </p>
      ) : null}
    </div>
  );
}
