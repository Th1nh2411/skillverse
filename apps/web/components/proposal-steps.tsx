import { Check } from "lucide-react";

const STEPS = ["Ủng hộ", "Duyệt", "Mở"] as const;

/** Tiến trình đề xuất kỹ năng mới: Ủng hộ → Duyệt → Mở. `current` = chỉ số bước đang ở (3 = đã mở). */
export function ProposalSteps({ current, failed }: { current: 0 | 1 | 2 | 3; failed?: boolean }) {
  return (
    <ol aria-label="Tiến trình đề xuất" className="flex items-center gap-1.5 text-[13px] font-semibold">
      {STEPS.map((s, i) => {
        const done = i < current;
        const now = i === current && !failed;
        return (
          <li key={s} className="flex items-center gap-1.5" aria-current={now ? "step" : undefined}>
            {i > 0 ? <span aria-hidden className={`h-px w-4 ${done || now ? "bg-accent" : "bg-border-strong"}`} /> : null}
            <span
              className={`inline-flex items-center gap-1 ${done ? "text-accent" : now ? "text-text" : "text-muted"}`}
            >
              {done ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
              {s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
