import type { Metadata } from "next";
import { Award, ShieldCheck, Zap } from "lucide-react";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { ShareButton } from "@/components/share-button";
import { ShareCard } from "@/components/share-card";
import { SaveButton } from "@/components/save-button";
import { SewingRingArt } from "@/components/illustrations";
import { ButtonLink } from "@/components/ui/button";
import { MilestoneBar, MilestonePatch } from "@/components/ui/milestone";
import { milestoneName } from "@/lib/milestone";
import { skillIcon } from "@/lib/skill-visual";

export const metadata: Metadata = { title: "Xong mốc" };

export default async function LevelUpPage({ params }: { params: Promise<{ proofId: string }> }) {
  const { proofId } = await params;
  const api = await getServerCaller();
  const s = await orNotFound(api.levelUp.summary({ proofId }));
  const badge = s.badges[0];
  const unlocked = s.unlockedSkills[0];
  const milestone = milestoneName(s.levelTitle, s.level);
  const rankUp = s.accountLevelAfter > s.accountLevelBefore;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[560px] flex-col items-center px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[5vh] text-center">
      <SaveButton targetType="proof" targetId={s.proofId} saved={s.saved} className="absolute right-3 top-3" />
      {s.totalVotes > 0 ? (
        <p className="tabular inline-flex items-center gap-1.5 text-[14px] font-semibold text-teal">
          <ShieldCheck size={17} aria-hidden />
          {s.passVotes}/{s.totalVotes} người công nhận
        </p>
      ) : null}

      <div className="relative mt-6">
        <SewingRingArt className="absolute inset-[-22%] h-[144%] w-[144%]" />
        <MilestonePatch
          categorySlug={s.skill.category.slug}
          rarity={s.skill.rarity}
          icon={skillIcon(s.skill.slug, s.skill.category.slug)}
          milestone={milestone}
          size={160}
          stitch
          prefix={false}
          label={`${s.skill.name}, mốc ${milestone}`}
          className="relative"
        />
      </div>

      <h1 className="rise-in mt-6 font-display text-[30px] font-extrabold leading-tight [animation-delay:1.9s]">
        Xong mốc {milestone}
      </h1>
      <p className="rise-in mt-0.5 text-[16px] font-semibold text-muted [animation-delay:1.95s]">{s.skill.name}</p>

      <div className="rise-in mt-4 flex w-full max-w-[280px] flex-col gap-1.5 [animation-delay:2s]">
        <MilestoneBar value={s.level} max={s.skill.maxLevel} showCount showNext={!s.isMaxLevel} />
        <p className="text-[14px]">
          {s.isMaxLevel ? (
            <b className="font-semibold text-teal">Xong cả {s.skill.maxLevel} mốc</b>
          ) : (
            <>
              <span className="text-accent">Mốc tiếp: </span>
              <b className="font-semibold">{milestoneName(s.nextLevelTitle, s.level + 1)}</b>
            </>
          )}
        </p>
      </div>

      <dl className={`rise-in mt-6 grid w-full ${badge || s.topPercent <= 50 ? "grid-cols-2" : "grid-cols-1"} divide-x divide-border border-y border-border py-4 [animation-delay:2.1s]`}>
        <div className="flex flex-col-reverse items-center gap-1.5 px-2">
          <dt className="tabular text-[13px] text-muted">
            {rankUp ? `Hạng ${s.accountLevelBefore} → ${s.accountLevelAfter}` : "Kinh nghiệm"}
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
        ) : s.topPercent <= 50 ? (
          <div className="flex flex-col-reverse items-center gap-1.5 px-2">
            <dt className="text-[13px] text-muted">Người luyện</dt>
            <dd className="tabular font-display text-[24px] font-extrabold leading-none">Top {s.topPercent}%</dd>
          </div>
        ) : null}
      </dl>

      <div className="rise-in mt-6 w-full text-left [animation-delay:2.2s]">
        <ShareCard
          displayName={s.displayName}
          skillSlug={s.skill.slug}
          skillName={s.skill.name}
          categorySlug={s.skill.category.slug}
          rarity={s.skill.rarity}
          milestone={milestone}
          verifiedCount={s.passVotes}
        />
      </div>

      <div className="mt-auto flex w-full flex-col gap-2.5 pt-6">
        <ShareButton
          path={`/share/${s.proofId}`}
          title={`${s.displayName} xong mốc ${milestone}, ${s.skill.name}`}
          text={`${s.skill.name}: xong mốc ${milestone} trên SkillVerse.`}
        />
        {unlocked ? (
          <ButtonLink href={`/skills/${unlocked.slug}`} variant="secondary" className="w-full">
            Mở khóa: {unlocked.name}
          </ButtonLink>
        ) : !s.isMaxLevel ? (
          <ButtonLink href={`/skills/${s.skill.slug}`} variant="secondary" className="w-full">
            Mốc tiếp
          </ButtonLink>
        ) : (
          <ButtonLink href={`/skills/tree/${s.skill.category.slug}`} variant="secondary" className="w-full">
            Cây kỹ năng
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
