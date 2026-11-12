import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { signOut } from "@/auth";
import { getServerCaller } from "@/lib/server/trpc";
import { ButtonLink } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { Avatar, EmptyState, ProgressBar } from "@/components/ui/misc";
import { TrailArt } from "@/components/illustrations";
import { NextMilestoneCard } from "@/components/next-milestone";
import { pickNextSkill } from "@/lib/next-skill";
import { SkillProgressRow } from "@/components/skill-progress";
import { formatNumber } from "@/lib/skill-visual";
import { SettingsButton } from "./settings-button";
import { ProfileTabs } from "./profile-tabs";

export const metadata: Metadata = { title: "Hồ sơ" };

type Profile = RouterOutputs["profile"]["me"];
type Featured = Profile["featuredSkills"][number];

async function logout() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const api = await getServerCaller();
  const p = await api.profile.me();
  const treeCategory = p.topCategories[0]?.slug ?? p.featuredSkills[0]?.category.slug ?? "sinh-ton";
  const nextSkill = pickNextSkill(p.featuredSkills);

  return (
    <main className="flex flex-col">
      <AppHeader extra={<SettingsButton logout={logout} isEditor={p.isEditor} />} />

      <section className="flex items-center gap-4 px-5 pt-4">
        <div className="relative shrink-0">
          <Avatar name={p.displayName} size={76} ring />
          <span
            className="tabular absolute -bottom-1 -right-1.5 min-w-8 rounded-[9px] border-2 border-bg bg-accent px-1.5 py-0.5 text-center font-display text-[13px] font-extrabold text-on-accent"
            aria-label={`Hạng ${p.xp.level}`}
          >
            {p.xp.level}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-display text-[24px] font-extrabold leading-tight">{p.displayName}</h1>
          <p className="truncate text-[14px] text-muted">@{p.handle}</p>
          {p.topCategories.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Danh mục chính">
              {p.topCategories.map((c) => (
                <li key={c.slug} className="rounded-[6px] bg-teal-soft px-2 py-0.5 text-[12px] font-semibold text-teal">
                  {c.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section aria-label="Kinh nghiệm" className="flex flex-col gap-2 px-5 pt-6">
        <div className="flex items-baseline justify-between text-[14px]">
          <span className="font-semibold">Hạng {p.xp.level + 1}</span>
          <span className="tabular text-muted">
            {formatNumber(p.xp.xpIntoLevel)} / {formatNumber(p.xp.xpForNextLevel)} XP
          </span>
        </div>
        <ProgressBar value={p.xp.xpIntoLevel} max={p.xp.xpForNextLevel} label={`Tiến độ lên hạng ${p.xp.level + 1}`} />
      </section>

      {nextSkill ? (
        <div className="mx-5 mt-6">
          <NextMilestoneCard s={nextSkill} />
        </div>
      ) : null}

      <dl className="mx-5 mt-6 grid grid-cols-3 divide-x divide-border border-y border-border py-4">
        <Stat value={p.stats.skillCount} label="Kỹ năng" />
        <Stat value={p.stats.rareBadgeCount} label="Huy hiệu hiếm" accent />
        <Stat value={p.stats.challengeCount} label="Thử thách" />
      </dl>

      <ProfileTabs
        initial={tab === "saved" ? "saved" : "skills"}
        skills={
          <section aria-labelledby="featured" className="flex flex-col pt-1">
            <div className="flex items-center justify-between px-5">
              <h2 id="featured" className="sr-only">
                Kỹ năng
              </h2>
              <span aria-hidden />
              <Link
                href={`/skills/tree/${treeCategory}`}
                className="-mr-2 inline-flex min-h-11 items-center gap-0.5 px-2 text-[14px] font-semibold text-accent"
              >
                Cây kỹ năng
                <ChevronRight size={16} aria-hidden />
              </Link>
            </div>

            {p.featuredSkills.length === 0 ? (
              <div className="px-5 pt-2">
                <EmptyState
                  art={<TrailArt size={150} />}
                  title="Chưa có kỹ năng nào. Chọn kỹ năng đầu tiên"
                  action={
                    <ButtonLink href="/discover" size="md">
                      Khám phá
                    </ButtonLink>
                  }
                />
              </div>
            ) : (
              <ul className="flex flex-col">
                {p.featuredSkills.map((s) => (
                  <FeaturedRow key={s.skillId} s={s} />
                ))}
              </ul>
            )}
          </section>
        }
      />
    </main>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col-reverse items-center gap-0.5 px-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`tabular font-display text-[26px] font-extrabold leading-none ${accent ? "text-accent" : ""}`}>
        {formatNumber(value)}
      </dd>
    </div>
  );
}

function FeaturedRow({ s }: { s: Featured }) {
  return (
    <li>
      <SkillProgressRow
        s={s}
        pending={s.pendingTargetLevel !== null}
        verifiedByCount={s.verifiedByCount}
      />
    </li>
  );
}
