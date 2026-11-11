import type { Metadata } from "next";
import Link from "next/link";
import { Hourglass, Lock, ShieldAlert, TriangleAlert, TrendingUp, Users } from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { BackButton } from "@/components/ui/back-button";
import { Button, ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { ProgressBar } from "@/components/ui/misc";
import { InfoSheet } from "@/components/ui/sheet";
import { formatNumber, skillIcon } from "@/lib/skill-visual";
import { SkillTabs } from "./skill-tabs";

type Detail = RouterOutputs["skill"]["detail"];
type Proposal = Detail["openProposals"][number];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const api = await getServerCaller();
  const d = await api.skill.detail({ slug }).catch(() => null);
  return { title: d?.name ?? "Kỹ năng" };
}

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = await getServerCaller();
  const d = await orNotFound(api.skill.detail({ slug }));
  const myLevel = d.myLevel ?? 0;
  const nextLevel = myLevel < d.maxLevel ? myLevel + 1 : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-32">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/discover" />
        <Link
          href={`/skills/tree/${d.category.slug}`}
          className="inline-flex min-h-11 items-center px-1 text-[14px] font-semibold text-muted hover:text-text"
        >
          {d.category.name}
        </Link>
      </header>

      <section className="flex items-center gap-4 px-5 pt-3">
        <LevelPatch
          categorySlug={d.category.slug}
          rarity={d.rarity}
          state={myLevel > 0 ? "earned" : d.myPrerequisitesMet === false ? "locked" : "practicing"}
          level={myLevel > 0 ? myLevel : undefined}
          icon={myLevel > 0 ? undefined : skillIcon(d.slug, d.category.slug)}
          size={76}
          label={myLevel > 0 ? `Cấp của bạn: ${myLevel}` : d.name}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[27px] font-extrabold leading-[1.15]">{d.name}</h1>
          <div className="tabular flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} aria-hidden />
              <b className="font-bold text-text">{formatNumber(d.practicingCount)}</b> đang luyện
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp size={14} aria-hidden />
              <b className="font-bold text-text">{formatNumber(d.advancedCount)}</b> đạt cấp {d.advancedMinLevel}+
            </span>
          </div>
        </div>
      </section>

      {d.riskLevel !== "none" ? (
        <div className="mx-5 mt-4 flex items-center gap-2 self-start rounded-full border border-accent-line bg-accent-soft py-1 pl-3 pr-1 text-[13px] font-semibold text-accent">
          {d.riskLevel === "high" ? <ShieldAlert size={16} aria-hidden /> : <TriangleAlert size={16} aria-hidden />}
          {d.riskLevel === "high" ? "Rủi ro cao" : "Cần cẩn thận"}
          <InfoSheet title="An toàn khi luyện" label="Cách luyện an toàn">
            Luôn luyện ở nơi an toàn, có người biết bạn đang làm gì và có sẵn dụng cụ xử lý sự cố (nước dập lửa, bộ sơ cứu). Bằng
            chứng quay cảnh nguy hiểm cho bản thân hoặc người khác sẽ bị từ chối.
          </InfoSheet>
        </div>
      ) : null}

      <SkillTabs
        description={d.description}
        levels={
          <ol className="flex flex-col">
            {d.levels.map((lv) => (
              <LevelRow key={lv.level} lv={lv} myLevel={myLevel} next={lv.level === nextLevel} />
            ))}
          </ol>
        }
      />

      {d.openProposals.length > 0 ? <Proposals proposals={d.openProposals} /> : null}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[560px] border-t border-border bg-bg px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        {d.myPendingProof ? (
          <Button disabled variant="secondary" className="w-full">
            <Hourglass size={18} aria-hidden />
            Chờ duyệt cấp {d.myPendingProof.targetLevel}
          </Button>
        ) : nextLevel === null ? null : d.myPrerequisitesMet === false ? (
          <ButtonLink href={`/skills/tree/${d.category.slug}`} variant="secondary" className="w-full">
            <Lock size={18} aria-hidden />
            Xem điều kiện mở
          </ButtonLink>
        ) : (
          <ButtonLink href={`/proof/new?skill=${d.slug}`} className="w-full">
            Thử lên cấp {nextLevel}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function LevelRow({ lv, myLevel, next }: { lv: Detail["levels"][number]; myLevel: number; next: boolean }) {
  const done = lv.level <= myLevel;
  const [first, ...rest] = lv.criteria;
  return (
    <li>
      <details
        open={next}
        className={`group rounded-[14px] px-3 py-1 ${next ? "bg-surface outline-1 outline-accent-line outline" : ""}`}
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span
            className={`tabular flex size-8 shrink-0 items-center justify-center rounded-[9px] font-display text-[15px] font-extrabold ${
              done
                ? "bg-accent text-on-accent"
                : next
                  ? "border-2 border-accent text-accent"
                  : "border border-border text-muted"
            }`}
            aria-label={`Cấp ${lv.level}${done ? ", đã đạt" : ""}`}
          >
            {lv.level}
          </span>
          <span className={`line-clamp-2 flex-1 text-[14px] leading-snug ${done || next ? "text-text" : "text-muted"}`}>
            {first?.text ?? lv.title ?? `Cấp ${lv.level}`}
          </span>
          {next ? (
            <span className="tabular shrink-0 text-[12px] font-bold text-accent">+{lv.xpReward} XP</span>
          ) : null}
        </summary>
        {rest.length > 0 ? (
          <ul className="flex flex-col gap-1.5 pb-3 pl-11 text-[13px] leading-snug text-muted">
            {rest.map((c) => (
              <li key={c.id} className="list-disc marker:text-border-strong">
                {c.text}
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </li>
  );
}

function Proposals({ proposals }: { proposals: Proposal[] }) {
  const p = proposals[0]!;
  const ratio = p.agreeRatio ?? 0;
  return (
    <section aria-labelledby="proposals" className="mx-5 mt-6 flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 id="proposals" className="text-[16px] font-bold">
            Góp ý tiêu chí
          </h2>
          <InfoSheet title="Sửa tiêu chí" label="Cách thông qua góp ý">
            Góp ý được thông qua khi đạt {Math.round(p.rule.agree_ratio * 100)}% đồng ý, tối thiểu {p.rule.min_votes} phiếu. Chỉ
            phiếu của người đạt cấp {p.rule.voter_min_level} trở lên được tính. Tiêu chí mới áp dụng cho bằng chứng nộp sau đó.
          </InfoSheet>
        </div>
        {proposals.length > 1 ? (
          <span className="tabular text-[13px] text-muted">{proposals.length} đang mở</span>
        ) : null}
      </div>
      <p className="text-[14px] leading-snug">
        {p.targetLevel ? <b className="font-semibold">Cấp {p.targetLevel}: </b> : null}
        {(p.summary ?? p.proposedCriteria[0]?.text ?? "").replace(/^Cấp\s*\d+\s*:\s*/i, "")}
      </p>
      <ProgressBar value={Math.round(ratio * 100)} max={100} tone="teal" label="Tỉ lệ đồng ý" />
      <div className="tabular flex items-center justify-between text-[13px] text-muted">
        <span>
          <b className="font-bold text-teal">{Math.round(ratio * 100)}%</b> đồng ý
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={13} aria-hidden />
          {formatNumber(p.voteCount)} phiếu
        </span>
      </div>
    </section>
  );
}
