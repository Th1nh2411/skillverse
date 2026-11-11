"use client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { MAX_CRITERIA_PER_LEVEL } from "@skillverse/validation";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";

type Level = { id: string; level: number; criteria: string[] };
const field =
  "w-full rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none";

export function SuggestForm({ skill, levels, initialLevel }: { skill: { slug: string; name: string }; levels: Level[]; initialLevel: number }) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [levelNo, setLevelNo] = useState(levels.find((l) => l.level === initialLevel)?.level ?? levels[0]!.level);
  const current = levels.find((l) => l.level === levelNo)!;
  const [criteria, setCriteria] = useState<string[]>(current.criteria);
  const [summary, setSummary] = useState("");
  const [rationale, setRationale] = useState("");
  const create = useMutation(
    trpc.proposal.createCriteriaEdit.mutationOptions({ onSuccess: (r) => router.replace(`/proposals/${r.proposalId}`) }),
  );

  const clean = criteria.map((c) => c.trim()).filter((c) => c.length >= 3);
  const changed = clean.join("\n") !== current.criteria.join("\n");
  const ready = changed && clean.length > 0 && summary.trim().length >= 5 && !create.isPending;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-32">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback={`/skills/${skill.slug}`} label="Đóng" />
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-[22px] font-extrabold leading-tight">Góp ý tiêu chí</h1>
          <p className="truncate text-[13px] text-muted">{skill.name}</p>
        </div>
      </header>

      <div role="radiogroup" aria-label="Cấp" className="no-scrollbar mx-5 mt-4 flex gap-2 overflow-x-auto">
        {levels.map((l) => {
          const on = l.level === levelNo;
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setLevelNo(l.level);
                setCriteria(l.criteria);
              }}
              className={`tabular min-h-11 shrink-0 rounded-full px-4 text-[14px] font-semibold ${
                on ? "bg-text text-bg" : "border border-border text-text hover:bg-surface-2"
              }`}
            >
              Cấp {l.level}
            </button>
          );
        })}
      </div>

      <section aria-labelledby={`${id}-c`} className="mx-5 mt-5 flex flex-col gap-2">
        <h2 id={`${id}-c`} className="text-[13px] font-semibold text-muted">
          Tiêu chí cấp {levelNo}
        </h2>
        {criteria.map((c, i) => (
          <div key={`${levelNo}-${i}`} className="flex items-center gap-1">
            <input
              aria-label={`Tiêu chí ${i + 1}`}
              value={c}
              maxLength={200}
              onChange={(e) => setCriteria((cs) => cs.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${field} min-h-12 py-2.5`}
            />
            {criteria.length > 1 ? (
              <button
                type="button"
                aria-label={`Bỏ tiêu chí ${i + 1}`}
                onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))}
                className="inline-flex size-11 shrink-0 items-center justify-center text-muted hover:text-text"
              >
                <X size={18} aria-hidden />
              </button>
            ) : null}
          </div>
        ))}
        {criteria.length < MAX_CRITERIA_PER_LEVEL ? (
          <button
            type="button"
            onClick={() => setCriteria((cs) => [...cs, ""])}
            className="inline-flex min-h-11 items-center gap-1 self-start px-1 text-[14px] font-semibold text-muted hover:text-text"
          >
            <Plus size={16} aria-hidden />
            Thêm tiêu chí
          </button>
        ) : null}
      </section>

      <div className="mx-5 mt-4 flex flex-col gap-1.5">
        <label htmlFor={`${id}-s`} className="text-[13px] font-semibold text-muted">
          Tóm tắt thay đổi
        </label>
        <input
          id={`${id}-s`}
          value={summary}
          maxLength={200}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Giảm thời gian xuống 4 phút"
          className={field}
        />
      </div>
      <div className="mx-5 mt-4 flex flex-col gap-1.5">
        <label htmlFor={`${id}-r`} className="text-[13px] font-semibold text-muted">
          Lý do
        </label>
        <textarea
          id={`${id}-r`}
          rows={3}
          maxLength={1000}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Không bắt buộc"
          className={`${field} resize-none`}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[560px] flex-col gap-2 border-t border-border bg-bg px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        {create.error ? (
          <p role="alert" className="text-[14px] text-danger">
            {create.error.message}
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={!ready}
          onClick={() =>
            create.mutate({
              skillLevelId: current.id,
              criteria: clean.map((text) => ({ text, kind: "checklist" as const })),
              summary: summary.trim(),
              rationale: rationale.trim() || undefined,
            })
          }
        >
          {create.isPending ? "Đang gửi" : "Gửi góp ý"}
        </Button>
      </div>
    </main>
  );
}
