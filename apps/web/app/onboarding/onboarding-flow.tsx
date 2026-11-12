"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Lightbulb, Plus, Search, Video, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import type { RouterOutputs } from "@skillverse/api";
import { SELF_LEVEL_LABELS, selfLevel, type SelfLevel } from "@skillverse/validation";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { LevelPatch } from "@/components/ui/level-patch";
import { Skeleton } from "@/components/ui/misc";
import { InfoSheet } from "@/components/ui/sheet";
import { BackpackArt } from "@/components/illustrations";
import { milestoneName } from "@/lib/milestone";
import { skillIcon } from "@/lib/skill-visual";
import { useTRPC } from "@/lib/trpc";

type SkillOption = RouterOutputs["onboarding"]["options"]["popularSkills"][number];
type FirstChallenge = NonNullable<RouterOutputs["onboarding"]["complete"]["firstChallenge"]>;

const SELF_LEVELS = selfLevel.options;

export function OnboardingFlow() {
  const trpc = useTRPC();
  const router = useRouter();
  const options = useQuery(trpc.onboarding.options.queryOptions());
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [picked, setPicked] = useState<SkillOption[]>([]);
  const [levels, setLevels] = useState<Record<string, SelfLevel>>({});
  const [challenge, setChallenge] = useState<FirstChallenge | null>(null);

  const complete = useMutation(
    trpc.onboarding.complete.mutationOptions({
      onSuccess: (res) => {
        if (res.firstChallenge) {
          setChallenge(res.firstChallenge);
          setStep(3);
        } else {
          finish();
        }
      },
    }),
  );

  function finish(next = "/profile") {
    router.replace(next);
    router.refresh();
  }

  const minSkills = options.data?.minSkills ?? 3;
  const pickedIds = new Set(picked.map((s) => s.id));
  const toggle = (s: SkillOption) =>
    setPicked((prev) => (prev.some((p) => p.id === s.id) ? prev.filter((p) => p.id !== s.id) : [...prev, s]));

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-6 px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-5">
      <div className="flex items-center gap-2">
        {step === 2 ? (
          <IconButton label="Quay lại chọn kỹ năng" icon={ArrowLeft} className="-ml-2" onClick={() => setStep(1)} />
        ) : null}
        <div
          role="progressbar"
          aria-label="Tiến độ thiết lập"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={step}
          className="grid flex-1 grid-cols-3 gap-1.5"
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-3"}`} />
          ))}
        </div>
      </div>

      {step === 1 ? (
        <>
          <header className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h1 className="font-display text-[28px] font-extrabold leading-tight">Bạn muốn giỏi điều gì?</h1>
              <p className="tabular text-[14px] text-muted">Chọn ít nhất {minSkills} kỹ năng.</p>
            </div>
            <BackpackArt size={96} className="shrink-0 text-muted" />
          </header>

          {options.isPending ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-28 rounded-full" />
              ))}
            </div>
          ) : options.error ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-danger">Không tải được danh sách kỹ năng.</p>
              <Button variant="secondary" size="md" onClick={() => options.refetch()}>
                Thử lại
              </Button>
            </div>
          ) : (
            <SkillPicker
              base={dedupe([...(options.data?.popularSkills ?? []), ...(options.data?.rareSkills ?? [])])}
              picked={picked}
              pickedIds={pickedIds}
              onToggle={toggle}
            />
          )}

          <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-bg pb-1 pt-3">
            <Button disabled={picked.length < minSkills} onClick={() => setStep(2)} className="w-full">
              {picked.length < minSkills ? (
                <span className="tabular">
                  Đã chọn {picked.length}/{minSkills}
                </span>
              ) : (
                "Tiếp tục"
              )}
            </Button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <header className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[28px] font-extrabold leading-tight">Bạn đang ở đâu?</h1>
              <InfoSheet title="Trình độ tự chọn">
                Lựa chọn này chỉ giúp gợi ý mốc vừa sức. Mỗi mốc chỉ được công nhận khi có video được cộng đồng duyệt.
              </InfoSheet>
            </div>
            <p className="text-[14px] text-muted">Để gợi ý mốc vừa sức.</p>
          </header>

          <ul className="flex flex-col gap-5">
            {picked.map((s) => (
              <li key={s.id} className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <LevelPatch
                    categorySlug={s.category.slug}
                    rarity={s.rarity}
                    state="practicing"
                    icon={skillIcon(s.slug, s.category.slug)}
                    size={36}
                  />
                  <span id={`lv-${s.id}`} className="text-[15px] font-semibold">
                    {s.name}
                  </span>
                </div>
                <div role="radiogroup" aria-labelledby={`lv-${s.id}`} className="grid grid-cols-3 gap-1.5">
                  {SELF_LEVELS.map((lv) => {
                    const on = (levels[s.id] ?? "beginner") === lv;
                    return (
                      <button
                        key={lv}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setLevels((p) => ({ ...p, [s.id]: lv }))}
                        className={`min-h-11 rounded-[10px] px-1 text-[12px] font-semibold leading-tight transition-colors min-[380px]:text-[13px] ${
                          on ? "bg-text text-bg" : "border border-border text-text hover:bg-surface-2"
                        }`}
                      >
                        {SELF_LEVEL_LABELS[lv]}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-bg pb-1 pt-3">
            {complete.error ? (
              <p role="alert" className="text-[14px] text-danger">
                {complete.error.message}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={complete.isPending}
              onClick={() =>
                complete.mutate({
                  skillIds: picked.map((s) => s.id),
                  selfLevels: Object.fromEntries(picked.map((s) => [s.id, levels[s.id] ?? "beginner"])),
                })
              }
            >
              {complete.isPending ? "Đang lưu" : "Tiếp tục"}
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 && challenge ? (
        <>
          <header className="flex flex-col gap-1.5">
            <h1 className="font-display text-[28px] font-extrabold leading-tight">Mốc đầu tiên</h1>
            <p className="text-[14px] text-muted">Làm được thì quay video.</p>
          </header>

          <section className="flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-accent-line bg-accent-soft px-5 py-7 text-center">
            <LevelPatch
              categorySlug={pickedCategory(picked, challenge.skillId)}
              state="practicing"
              icon={skillIcon(challenge.slug, pickedCategory(picked, challenge.skillId))}
              size={84}
              label={challenge.name}
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-[14px] text-accent-ink">{challenge.name}</p>
              <h2 className="font-display text-[24px] font-extrabold leading-tight">
                {milestoneName(challenge.levelTitle, challenge.targetLevel)}
              </h2>
              {challenge.criteria[0] ? (
                <p className="inline-flex items-start justify-center gap-1.5 text-[15px] font-semibold leading-snug">
                  <Video size={17} className="mt-0.5 shrink-0 text-accent" aria-label="Video cần thấy" />
                  {challenge.criteria[0].text}
                </p>
              ) : null}
            </div>
            {challenge.levelDescription ? (
              <p className="flex items-start gap-2 text-left text-[14px] leading-relaxed text-accent-ink">
                <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-label="Cách làm" />
                {challenge.levelDescription}
              </p>
            ) : null}
            <span className="tabular inline-flex items-center gap-1 text-[15px] font-bold text-accent">
              <Zap size={16} aria-hidden />+{challenge.xpReward} XP
            </span>
          </section>

          <div className="mt-auto flex flex-col gap-2">
            <Button className="w-full" onClick={() => finish(`/proof/new?skill=${challenge.slug}`)}>
              <Video size={20} aria-hidden />
              Quay video
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => finish()}>
              Để sau
            </Button>
          </div>
        </>
      ) : null}
    </main>
  );
}

function pickedCategory(picked: SkillOption[], skillId: string) {
  return picked.find((s) => s.id === skillId)?.category.slug ?? "sinh-ton";
}

function dedupe(list: SkillOption[]) {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

function SkillPicker({
  base,
  picked,
  pickedIds,
  onToggle,
}: {
  base: SkillOption[];
  picked: SkillOption[];
  pickedIds: Set<string>;
  onToggle: (s: SkillOption) => void;
}) {
  const trpc = useTRPC();
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q.trim());
  const search = useQuery({ ...trpc.skill.search.queryOptions({ query: dq, limit: 12 }), enabled: dq.length > 0 });

  // Kỹ năng đã chọn qua tìm kiếm vẫn hiện trong danh sách chip.
  const chips = useMemo(() => dedupe([...base, ...picked]), [base, picked]);
  const found = (search.data ?? []).filter((s) => !chips.some((c) => c.id === s.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {chips.map((s) => (
          <Chip key={s.id} skill={s} on={pickedIds.has(s.id)} onClick={() => onToggle(s)} />
        ))}
        {!searching ? (
          <button
            type="button"
            onClick={() => setSearching(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-4 text-[14px] font-semibold text-muted hover:text-text"
          >
            <Plus size={16} aria-hidden />
            Tìm thêm
          </button>
        ) : null}
      </div>

      {searching ? (
        <div className="flex flex-col gap-3">
          <label className="flex min-h-12 items-center gap-2.5 rounded-[var(--radius-btn)] border border-border bg-surface px-4 focus-within:border-accent">
            <Search size={18} className="shrink-0 text-muted" aria-hidden />
            <input
              autoFocus
              type="search"
              aria-label="Tìm kỹ năng"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rubik, đan len, leo núi"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-muted/70 focus:outline-none"
            />
          </label>
          {dq && found.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {found.map((s) => (
                <Chip key={s.id} skill={s} on={false} onClick={() => onToggle(s)} />
              ))}
            </div>
          ) : dq && search.isSuccess && found.length === 0 && !chips.some((c) => match(c.name, dq)) ? (
            <p className="text-[14px] text-muted">Chưa có kỹ năng này.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function match(name: string, q: string) {
  return name.toLowerCase().includes(q.toLowerCase());
}

function Chip({ skill, on, onClick }: { skill: SkillOption; on: boolean; onClick: () => void }) {
  const Icon = skillIcon(skill.slug, skill.category.slug);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors ${
        on
          ? "border-2 border-accent bg-accent-soft pl-3 text-text"
          : "border border-border pl-3 text-text hover:bg-surface-2"
      }`}
    >
      {on ? <Check size={16} className="text-accent" aria-hidden /> : <Icon size={16} className="text-muted" aria-hidden />}
      {skill.name}
    </button>
  );
}
