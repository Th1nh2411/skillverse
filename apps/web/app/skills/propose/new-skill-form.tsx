"use client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Lightbulb, Plus, Video, X } from "lucide-react";
import { useId, useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { InfoSheet } from "@/components/ui/sheet";
import { ProposalSteps } from "@/components/proposal-steps";
import { useTRPC } from "@/lib/trpc";
import { categoryIcon } from "@/lib/skill-visual";

type Milestone = { title: string; task: string; description: string; guide: boolean };
const EXAMPLES: [string, string][] = [
  ["Bật lửa", "Nhóm bằng bật lửa"],
  ["Đá lửa", "Nhóm bằng đá lửa"],
  ["Trời gió", "Nhóm khi có gió"],
  ["Trời mưa", "Nhóm bằng củi ướt"],
  ["Một que diêm", "Một que diêm, dưới 3 phút"],
];
const blank = (): Milestone => ({ title: "", task: "", description: "", guide: false });

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
  limits: { minLevels: number; maxLevels: number; titleMax: number; descriptionMax: number };
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [levels, setLevels] = useState<Milestone[]>(() => Array.from({ length: limits.minLevels }, blank));
  const [risky, setRisky] = useState(false);
  const [risk, setRisk] = useState<Exclude<Risk, "none">>("low");
  const create = useMutation(trpc.proposal.createNewSkill.mutationOptions({ onSuccess: (r) => router.replace(`/proposals/${r.proposalId}`) }));

  const filled = levels.every((l) => l.title.trim().length >= 1 && l.task.trim().length >= 3);
  const ready = name.trim().length >= 2 && category && filled && !create.isPending;

  const setAt = (li: number, patch: Partial<Milestone>) =>
    setLevels((ls) => ls.map((l, i) => (i === li ? { ...l, ...patch } : l)));

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
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full pl-3 pr-4 text-[14px] font-semibold transition-colors ${
                  on ? "bg-text text-bg" : "border border-border text-text hover:bg-surface-2"
                }`}
              >
                <CatIcon slug={c.slug} />
                {c.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby={`${id}-levels`} className="mx-5 mt-6 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id={`${id}-levels`} className="text-[15px] font-bold">
            Các mốc
          </h2>
          <span className="tabular text-[13px] text-muted">
            {limits.minLevels}–{limits.maxLevels} mốc
          </span>
        </div>
        <ol className="flex flex-col gap-4">
          {levels.map((m, li) => {
            const ex = EXAMPLES[li] ?? EXAMPLES[EXAMPLES.length - 1]!;
            return (
              <li key={li} className="flex gap-3">
                <span
                  className="tabular mt-2 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong font-display text-[14px] font-extrabold text-muted"
                  aria-hidden
                >
                  {li + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      aria-label={`Tên mốc ${li + 1}`}
                      value={m.title}
                      maxLength={limits.titleMax}
                      onChange={(e) => setAt(li, { title: e.target.value })}
                      placeholder={ex[0]}
                      className={`${field} min-h-12 py-2.5 font-semibold`}
                    />
                    {li >= limits.minLevels && li === levels.length - 1 ? (
                      <button
                        type="button"
                        aria-label={`Bỏ mốc ${li + 1}`}
                        onClick={() => setLevels((ls) => ls.slice(0, -1))}
                        className="inline-flex size-11 shrink-0 items-center justify-center text-muted hover:text-text"
                      >
                        <X size={18} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 rounded-[var(--radius-btn)] border border-border bg-surface pl-3 focus-within:border-accent">
                    <Video size={16} className="shrink-0 text-accent" aria-hidden />
                    <input
                      aria-label={`Việc cần làm ở mốc ${li + 1}`}
                      value={m.task}
                      maxLength={200}
                      onChange={(e) => setAt(li, { task: e.target.value })}
                      placeholder={ex[1]}
                      className="min-h-12 min-w-0 flex-1 bg-transparent py-2.5 pr-4 text-[15px] text-text placeholder:text-muted/70 focus:outline-none"
                    />
                  </label>
                  {m.guide ? (
                    <label className="flex items-start gap-2 rounded-[var(--radius-btn)] border border-border bg-surface pl-3 focus-within:border-accent">
                      <Lightbulb size={16} className="mt-3.5 shrink-0 text-muted" aria-hidden />
                      <textarea
                        aria-label={`Cách làm mốc ${li + 1}`}
                        rows={2}
                        value={m.description}
                        maxLength={limits.descriptionMax}
                        onChange={(e) => setAt(li, { description: e.target.value })}
                        placeholder="Không bắt buộc"
                        className="min-w-0 flex-1 resize-none bg-transparent py-3 pr-4 text-[14px] text-text placeholder:text-muted/70 focus:outline-none"
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAt(li, { guide: true })}
                      className="inline-flex min-h-11 items-center gap-1 self-start px-1 text-[13px] font-semibold text-muted hover:text-text"
                    >
                      <Plus size={14} aria-hidden />
                      Cách làm
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {levels.length < limits.maxLevels ? (
          <button
            type="button"
            onClick={() => setLevels((ls) => [...ls, blank()])}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-border-strong text-[14px] font-semibold text-muted hover:text-text"
          >
            <Plus size={16} aria-hidden />
            Thêm mốc
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
            Bạn là người ủng hộ đầu tiên. Khi đủ người ủng hộ trong thời hạn, biên tập viên kiểm tra an toàn và các mốc rồi mở kỹ
            năng cho mọi người. Các mốc vẫn tiếp tục nhận góp ý sau khi mở.
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
              levels: levels.map((l) => ({
                title: l.title.trim(),
                description: l.description.trim() || undefined,
                criteria: [{ text: l.task.trim(), kind: "checklist" as const }],
              })),
            })
          }
        >
          {create.isPending ? "Đang gửi" : "Gửi đề xuất"}
        </Button>
      </div>
    </main>
  );
}

function CatIcon({ slug }: { slug: string }) {
  const Icon = categoryIcon(slug);
  return <Icon size={16} aria-hidden />;
}
