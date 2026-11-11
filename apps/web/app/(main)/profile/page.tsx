import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronRight, Hourglass, ShieldCheck, Sprout } from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { signOut } from "@/auth";
import { getServerCaller } from "@/lib/server/trpc";
import { ButtonLink } from "@/components/ui/button";
import { IconLink } from "@/components/ui/icon-button";
import { LevelPatch } from "@/components/ui/level-patch";
import { Avatar, EmptyState, ProgressBar } from "@/components/ui/misc";
import { formatNumber, skillIcon } from "@/lib/skill-visual";
import { SettingsButton } from "./settings-button";

export const metadata: Metadata = { title: "Hồ sơ" };

type Profile = RouterOutputs["profile"]["me"];
type Featured = Profile["featuredSkills"][number];

async function logout() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function ProfilePage() {
  const api = await getServerCaller();
  const p = await api.profile.me();
  const treeCategory = p.topCategories[0]?.slug ?? p.featuredSkills[0]?.category.slug ?? "sinh-ton";

  return (
    <main className="flex flex-col">
      <header className="flex items-center justify-between px-5 pb-1 pt-4">
        <span className="font-display text-[21px] font-extrabold tracking-[-0.01em]">SkillVerse</span>
        <div className="-mr-2 flex">
          <IconLink href="/notifications" label="Thông báo" icon={Bell} />
          <SettingsButton logout={logout} />
        </div>
      </header>

      <section className="flex items-center gap-4 px-5 pt-4">
        <div className="relative shrink-0">
          <Avatar name={p.displayName} size={76} ring />
          <span
            className="tabular absolute -bottom-1 -right-1.5 min-w-8 rounded-[9px] border-2 border-bg bg-accent px-1.5 py-0.5 text-center font-display text-[13px] font-extrabold text-on-accent"
            aria-label={`Cấp ${p.xp.level}`}
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
          <span className="font-semibold">Lên cấp {p.xp.level + 1}</span>
          <span className="tabular text-muted">
            {formatNumber(p.xp.xpIntoLevel)} / {formatNumber(p.xp.xpForNextLevel)} XP
          </span>
        </div>
        <ProgressBar value={p.xp.xpIntoLevel} max={p.xp.xpForNextLevel} label={`Tiến độ lên cấp ${p.xp.level + 1}`} />
      </section>

      <dl className="mx-5 mt-6 grid grid-cols-3 divide-x divide-border border-y border-border py-4">
        <Stat value={p.stats.skillCount} label="Kỹ năng" />
        <Stat value={p.stats.rareBadgeCount} label="Huy hiệu hiếm" accent />
        <Stat value={p.stats.challengeCount} label="Thử thách" />
      </dl>

      <section aria-labelledby="featured" className="flex flex-col pt-6">
        <div className="flex items-center justify-between px-5">
          <h2 id="featured" className="text-[17px] font-bold">
            Kỹ năng nổi bật
          </h2>
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
              icon={Sprout}
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
  const earned = s.level > 0;
  return (
    <li>
      <Link
        href={`/skills/${s.slug}`}
        className="flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-surface active:bg-surface-2"
      >
        <LevelPatch
          categorySlug={s.category.slug}
          rarity={s.rarity}
          state={earned ? "earned" : "practicing"}
          level={earned ? s.level : undefined}
          icon={earned ? undefined : skillIcon(s.slug, s.category.slug)}
          size={52}
          label={`${s.name}, cấp ${s.level}`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-semibold">{s.name}</span>
            <span className="tabular shrink-0 text-[13px] font-semibold text-muted">
              {s.level}/{s.maxLevel}
            </span>
          </div>
          <ProgressBar value={s.level} max={s.maxLevel} tone="thread" size="sm" label={`Cấp ${s.level} trên ${s.maxLevel}`} />
          {s.pendingTargetLevel !== null || s.verifiedByCount > 0 ? (
          <div className="flex items-center gap-3 text-[12px] font-semibold">
            {s.pendingTargetLevel !== null ? (
              <span className="inline-flex items-center gap-1 text-muted">
                <Hourglass size={13} aria-hidden />
                Chờ duyệt cấp {s.pendingTargetLevel}
              </span>
            ) : s.verifiedByCount > 0 ? (
              <span className="tabular inline-flex items-center gap-1 text-teal">
                <ShieldCheck size={14} aria-hidden />
                <span className="sr-only">Đã xác thực bởi</span>
                {s.verifiedByCount}
                <span className="sr-only">người</span>
              </span>
            ) : null}
          </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
