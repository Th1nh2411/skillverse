"use client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { InfoSheet } from "@/components/ui/sheet";
import { ProposalSteps } from "@/components/proposal-steps";
import { useTRPC } from "@/lib/trpc";

type Risk = "none" | "low" | "high";
const field =
  "w-full rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none";

export function NewSkillForm({
  initialName,
  categories,
  limits,
}: {
  initialName: string;
  categories: { slug: string; name: string }[];
  limits: { minLevels: number; maxLevels: number; maxCriteria: number };
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [levels, setLevels] = useState<string[][]>(() => Array.from({ length: limits.minLevels }, () => [""]));
  const [risky, setRisky] = useState(false);
  const [risk, setRisk] = useState<Exclude<Risk, "none">>("low");
  const create = useMutation(trpc.proposal.createNewSkill.mutationOptions({ onSuccess: (r) => router.replace(`/proposals/${r.proposalId}`) }));

  const filled = levels.every((l) => l.some((c) => c.trim().length >= 3));
  const ready = name.trim().length >= 2 && category && filled && !create.isPending;

  const setCrit = (li: number, ci: number, v: string) =>
    setLevels((ls) => ls.map((l, i) => (i === li ? l.map((c, j) => (j === ci ? v : c)) : l)));

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-40">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/discover" label="Đóng" />
        <h1 className="font-display text-[22px] font-extrabold">Đề xuất kỹ năng mới</h1>
      </header>

      <div className="mx-5 mt-4 flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-[13px] font-semibold text-muted">
          Tên kỹ năng
        </label>
        <input
          id={`${id}-name`}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Huýt sáo bằng lá"
          className={field}
        />
      </div>

      <fieldset className="mx-5 mt-5 flex flex-col gap-2">
        <legend className="pb-2 text-[13px] font-semibold text-muted">Danh mục</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = category === c.slug;
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={on}
                onClick={() => setCategory(c.slug)}
                className={`min-h-11 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                  on ? "bg-text text-bg" : "border border-border text-text hover:bg-surface-2"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby={`${id}-levels`} className="mx-5 mt-6 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id={`${id}-levels`} className="text-[15px] font-bold">
            Tiêu chí từng cấp
          </h2>
          <span className="tabular text-[13px] text-muted">Tối thiểu {limits.minLevels} cấp</span>
        </div>
        <ol className="flex flex-col gap-3">
          {levels.map((crit, li) => (
            <li key={li} className="flex gap-3">
              <span
                className="tabular mt-2 flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-border font-display text-[15px] font-extrabold text-muted"
                aria-hidden
              >
                {li + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {crit.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-1">
                    <input
                      aria-label={`Cấp ${li + 1}, tiêu chí ${ci + 1}`}
                      value={c}
                      maxLength={200}
                      onChange={(e) => setCrit(li, ci, e.target.value)}
                      placeholder={ci === 0 ? "Làm được gì ở cấp này?" : "Thêm điều kiện"}
                      className={`${field} min-h-12 py-2.5`}
                    />
                    {ci > 0 ? (
                      <button
                        type="button"
                        aria-label={`Bỏ tiêu chí ${ci + 1} của cấp ${li + 1}`}
                        onClick={() => setLevels((ls) => ls.map((l, i) => (i === li ? l.filter((_, j) => j !== ci) : l)))}
                        className="inline-flex size-11 shrink-0 items-center justify-center text-muted hover:text-text"
                      >
                        <X size={18} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ))}
                {crit.length < limits.maxCriteria && crit[crit.length - 1]?.trim() ? (
                  <button
                    type="button"
                    onClick={() => setLevels((ls) => ls.map((l, i) => (i === li ? [...l, ""] : l)))}
                    className="inline-flex min-h-11 items-center gap-1 self-start px-1 text-[13px] font-semibold text-muted hover:text-text"
                  >
                    <Plus size={14} aria-hidden />
                    Điều kiện
                  </button>
                ) : null}
              </div>
              {li >= limits.minLevels && li === levels.length - 1 ? (
                <button
                  type="button"
                  aria-label={`Bỏ cấp ${li + 1}`}
                  onClick={() => setLevels((ls) => ls.slice(0, -1))}
                  className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center text-muted hover:text-text"
                >
                  <X size={18} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {levels.length < limits.maxLevels ? (
          <button
            type="button"
            onClick={() => setLevels((ls) => [...ls, [""]])}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-border-strong text-[14px] font-semibold text-muted hover:text-text"
          >
            <Plus size={16} aria-hidden />
            Thêm cấp
          </button>
        ) : null}
      </section>

      <div className="mx-5 mt-5 flex flex-col gap-2 rounded-[14px] border border-border px-3.5 py-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={risky}
            onChange={(e) => setRisky(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="text-[14px] leading-snug">Có rủi ro (lửa, độ cao, dụng cụ sắc)</span>
        </label>
        {risky ? (
          <div role="radiogroup" aria-label="Mức rủi ro" className="grid grid-cols-2 gap-2 pl-8">
            {(
              [
                ["low", "Cần cẩn thận"],
                ["high", "Rủi ro cao"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={risk === v}
                onClick={() => setRisk(v)}
                className={`min-h-11 rounded-[10px] text-[13px] font-semibold ${
                  risk === v ? "bg-accent-soft text-accent outline outline-1 outline-accent-line" : "border border-border text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[560px] flex-col gap-2.5 border-t border-border bg-bg px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        <div className="flex items-center justify-center gap-1">
          <ProposalSteps current={0} />
          <InfoSheet title="Sau khi gửi" label="Cách đề xuất được mở">
            Bạn là người ủng hộ đầu tiên. Khi đủ người ủng hộ trong thời hạn, biên tập viên kiểm tra an toàn và tiêu chí rồi mở kỹ
            năng cho mọi người. Tiêu chí vẫn tiếp tục nhận góp ý sau khi mở.
          </InfoSheet>
        </div>
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
              name: name.trim(),
              categorySlug: category,
              riskLevel: risky ? risk : "none",
              levels: levels.map((l) => l.map((t) => t.trim()).filter((t) => t.length >= 3).map((text) => ({ text, kind: "checklist" as const }))),
            })
          }
        >
          {create.isPending ? "Đang gửi" : "Gửi đề xuất"}
        </Button>
      </div>
    </main>
  );
}
