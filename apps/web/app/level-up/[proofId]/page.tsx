import type { Metadata } from "next";
import { Award, ShieldCheck, Zap } from "lucide-react";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { ShareButton } from "@/components/share-button";
import { ShareCard } from "@/components/share-card";
import { ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";

export const metadata: Metadata = { title: "Lên cấp" };

export default async function LevelUpPage({ params }: { params: Promise<{ proofId: string }> }) {
  const { proofId } = await params;
  const api = await getServerCaller();
  const s = await orNotFound(api.levelUp.summary({ proofId }));
  const badge = s.badges[0];
  const next = s.unlockedSkills[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[6vh] text-center">
      <p className="tabular inline-flex items-center gap-1.5 text-[14px] font-semibold text-teal">
        <ShieldCheck size={17} aria-hidden />
        {s.passVotes}/{s.totalVotes} người xác thực
      </p>

      <div className="relative mt-5">
        <div
          aria-hidden
          className="absolute inset-[-20%] rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent)]"
        />
        <LevelPatch
          categorySlug={s.skill.category.slug}
          rarity={s.skill.rarity}
          level={s.level}
          size={168}
          stitch
          label={`${s.skill.name}, cấp ${s.level}`}
          className="relative"
        />
      </div>

      <h1 className="rise-in mt-5 font-display text-[32px] font-extrabold leading-tight [animation-delay:1.9s]">
        Lên cấp {s.level}
      </h1>
      <p className="rise-in mt-0.5 text-[17px] font-semibold [animation-delay:1.95s]">{s.skill.name}</p>
      {s.topPercent <= 50 ? (
        <p className="rise-in tabular mt-1 text-[14px] text-muted [animation-delay:2s]">
          Top {s.topPercent}% người luyện kỹ năng này
        </p>
      ) : null}

      <dl className="rise-in mt-6 grid w-full grid-cols-2 divide-x divide-border border-y border-border py-4 [animation-delay:2.1s]">
        <div className="flex flex-col-reverse items-center gap-1.5 px-2">
          <dt className="tabular text-[13px] text-muted">
            {s.accountLevelAfter > s.accountLevelBefore
              ? `Cấp ${s.accountLevelBefore} → ${s.accountLevelAfter}`
              : `Tài khoản cấp ${s.accountLevelAfter}`}
          </dt>
          <dd className="tabular inline-flex items-center gap-1 font-display text-[24px] font-extrabold leading-none text-accent">
            <Zap size={19} aria-hidden />+{s.xpAwarded} XP
          </dd>
        </div>
        {badge ? (
          <div className="flex flex-col-reverse items-center gap-1.5 px-2">
            <dt className="text-[13px] text-muted">Huy hiệu mới</dt>
            <dd className="inline-flex items-center gap-1.5 text-[16px] font-bold leading-tight">
              <Award size={18} className="shrink-0 text-accent" aria-hidden />
              {badge.name}
            </dd>
          </div>
        ) : (
          <div className="flex flex-col-reverse items-center gap-1.5 px-2">
            <dt className="text-[13px] text-muted">{s.isMaxLevel ? "Cấp cao nhất" : "Cấp kỹ năng"}</dt>
            <dd className="tabular font-display text-[24px] font-extrabold leading-none">
              {s.level}/{s.skill.maxLevel}
            </dd>
          </div>
        )}
      </dl>

      <div className="rise-in mt-6 w-full text-left [animation-delay:2.2s]">
        <ShareCard
          displayName={s.displayName}
          skillName={s.skill.name}
          categorySlug={s.skill.category.slug}
          rarity={s.skill.rarity}
          level={s.level}
          verifiedCount={s.passVotes}
        />
      </div>

      <div className="mt-auto flex w-full flex-col gap-2.5 pt-6">
        <ShareButton
          path={`/share/${s.proofId}`}
          title={`${s.displayName} đạt cấp ${s.level} ${s.skill.name}`}
          text={`Đạt cấp ${s.level} ${s.skill.name} trên SkillVerse, được cộng đồng xác thực.`}
        />
        {next ? (
          <ButtonLink href={`/skills/${next.slug}`} variant="secondary" className="w-full">
            Mở khóa tiếp: {next.name}
          </ButtonLink>
        ) : (
          <ButtonLink href={`/skills/tree/${s.skill.category.slug}`} variant="secondary" className="w-full">
            Xem cây kỹ năng
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
