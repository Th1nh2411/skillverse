import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { BackButton } from "@/components/ui/back-button";
import { ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { EmptyState } from "@/components/ui/misc";
import { MilestoneBar } from "@/components/ui/milestone";
import { SummitArt, TrailArt, WaitArt } from "@/components/illustrations";
import { milestoneName, titleAt } from "@/lib/milestone";
import { skillIcon } from "@/lib/skill-visual";
import { ProofComposer } from "./proof-composer";

export const metadata: Metadata = { title: "Gửi video" };

export default async function NewProofPage({ searchParams }: { searchParams: Promise<{ skill?: string; challenge?: string }> }) {
  const { skill, challenge } = await searchParams;
  return skill ? <Compose slug={skill} challengeId={challenge} /> : <PickSkill />;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/profile" label="Đóng" />
        <h1 className="font-display text-[22px] font-extrabold">{title}</h1>
      </header>
      {children}
    </main>
  );
}

/** Không có ?skill= : chọn trong các kỹ năng đang luyện. */
async function PickSkill() {
  const api = await getServerCaller();
  const me = await api.profile.me();
  const options = me.featuredSkills.filter((s) => s.level < s.maxLevel && s.pendingTargetLevel === null);
  return (
    <Shell title="Chọn kỹ năng">
      {options.length === 0 ? (
        <div className="px-5 pt-4">
          <EmptyState
            art={<TrailArt size={150} />}
            title="Chưa có mốc nào đang chờ bạn"
            action={
              <ButtonLink href="/discover" size="md">
                Khám phá
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col pt-3">
          {options.map((s) => (
            <li key={s.skillId}>
              <Link
                href={`/proof/new?skill=${s.slug}`}
                className="flex min-h-16 items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-surface active:bg-surface-2"
              >
                <LevelPatch
                  categorySlug={s.category.slug}
                  rarity={s.rarity}
                  state={s.level > 0 ? "earned" : "practicing"}
                  icon={skillIcon(s.slug, s.category.slug)}
                  size={44}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[15px] font-semibold">{s.name}</span>
                  <span className="truncate text-[13px] text-muted">
                    Mốc tiếp: <b className="font-semibold text-text">{milestoneName(s.nextLevelTitle, s.level + 1)}</b>
                  </span>
                  <MilestoneBar value={s.level} max={s.maxLevel} />
                </span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

async function Compose({ slug, challengeId }: { slug: string; challengeId?: string }) {
  const api = await getServerCaller();
  const [d, limits] = await Promise.all([orNotFound(api.skill.detail({ slug })), api.proof.limits()]);
  const myLevel = d.myLevel ?? 0;
  const target = myLevel + 1;
  const level = d.levels.find((l) => l.level === target);

  if (d.myPendingProof) {
    return (
      <Shell title={d.name}>
        <div className="px-5 pt-4">
          <EmptyState
            art={<WaitArt size={130} />}
            title={`Mốc ${titleAt(d.levels, d.myPendingProof.targetLevel)} đang chờ duyệt`}
            action={
              <ButtonLink href={`/proofs/${d.myPendingProof.proofId}`} size="md" variant="secondary">
                Xem tiến độ
              </ButtonLink>
            }
          />
        </div>
      </Shell>
    );
  }
  if (!level) {
    return (
      <Shell title={d.name}>
        <div className="px-5 pt-4">
          <EmptyState art={<SummitArt size={150} />} title={`Xong cả ${d.maxLevel} mốc`} />
        </div>
      </Shell>
    );
  }
  if (d.myPrerequisitesMet === false) {
    return (
      <Shell title={d.name}>
        <div className="px-5 pt-4">
          <EmptyState
            icon={Lock}
            title="Cần xong kỹ năng nền trước"
            action={
              <ButtonLink href={`/skills/tree/${d.category.slug}`} size="md" variant="secondary">
                Xem cây kỹ năng
              </ButtonLink>
            }
          />
        </div>
      </Shell>
    );
  }

  return (
    <ProofComposer
      limits={limits}
      challengeId={challengeId}
      skill={{
        id: d.id,
        slug: d.slug,
        name: d.name,
        categorySlug: d.category.slug,
        rarity: d.rarity,
        riskLevel: d.riskLevel,
      }}
      progress={{ done: myLevel, max: d.maxLevel }}
      target={{
        level: target,
        name: milestoneName(level.title, target),
        criteria: level.criteria.map((c) => ({ id: c.id, text: c.text })),
        minReviewers: level.minReviewers,
        reviewerTitle: titleAt(d.levels, level.minReviewerLevel),
      }}
    />
  );
}
