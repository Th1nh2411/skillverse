import type { Metadata } from "next";
import { CircleCheck, CircleX, Hourglass, MessageSquareText, Scale, ShieldCheck } from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { BackButton } from "@/components/ui/back-button";
import { ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { InfoSheet } from "@/components/ui/sheet";
import { milestoneName } from "@/lib/milestone";
import { patchOf } from "@/lib/skill-visual";
import { AppealButton } from "./appeal-button";

export const metadata: Metadata = { title: "Video của tôi" };

type Status = RouterOutputs["proof"]["status"];

export default async function ProofStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await getServerCaller();
  const p = await orNotFound(api.proof.status({ proofId: id }));
  const patch = patchOf(p.skill);
  const decided = p.status === "passed" || p.status === "failed";
  const milestone = milestoneName(p.levelTitle, p.targetLevel);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-32">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/profile" />
        <span className="text-[14px] font-semibold text-muted">Video của bạn</span>
      </header>

      <section className="flex items-center gap-4 px-5 pt-3">
        <LevelPatch
          categorySlug={patch.categorySlug}
          rarity={patch.rarity}
          state={p.status === "passed" ? "earned" : "practicing"}
          icon={patch.icon}
          size={72}
          label={p.skill.name}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-[14px] text-muted">{p.skill.name}</p>
          <h1 className="font-display text-[24px] font-extrabold leading-tight">
            <span className="sr-only">Mốc </span>
            {milestone}
          </h1>
          <StatusLine p={p} />
        </div>
      </section>

      {p.video ? (
        <div className="mx-5 mt-5 overflow-hidden rounded-[var(--radius-card)] bg-black">
          <video src={p.video.url} controls playsInline preload="metadata" className="aspect-video w-full object-contain" />
        </div>
      ) : null}

      {!decided && !p.underEditorReview ? <Votes votes={p.votes} required={p.required} /> : null}

      {p.criteria && p.criteria.length > 0 ? (
        <section aria-labelledby="crit" className="mx-5 mt-6 flex flex-col">
          <h2 id="crit" className="pb-1 text-[15px] font-bold">
            Kết quả chấm
          </h2>
          <ul className="flex flex-col">
            {p.criteria.map((c) => {
              const ok = c.metCount > c.notMetCount;
              return (
                <li key={c.id} className="flex min-h-12 items-center gap-3 border-b border-border py-2 last:border-0">
                  {ok ? (
                    <CircleCheck size={20} className="shrink-0 text-teal" aria-label="Đạt" />
                  ) : (
                    <CircleX size={20} className="shrink-0 text-danger" aria-label="Chưa đạt" />
                  )}
                  <span className="flex-1 text-[14px] leading-snug">{c.text}</span>
                  <span
                    className="tabular shrink-0 text-[13px] font-semibold text-muted"
                    aria-label={`${c.metCount} trên ${c.metCount + c.notMetCount} người chấm đạt`}
                  >
                    {c.metCount}/{c.metCount + c.notMetCount}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {p.comments && p.comments.length > 0 ? (
        <section aria-labelledby="notes" className="mx-5 mt-5 flex flex-col gap-2">
          <h2 id="notes" className="flex items-center gap-2 text-[15px] font-bold">
            <MessageSquareText size={18} className="text-muted" aria-hidden />
            Nhận xét
          </h2>
          <ul className="flex flex-col gap-2">
            {p.comments.map((n, i) => (
              <li key={i} className="rounded-[14px] bg-surface px-3.5 py-2.5 text-[14px] leading-snug">
                {n}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.appeal ? (
        <p className="mx-5 mt-5 flex items-center gap-2 text-[14px] font-semibold text-muted">
          <Scale size={17} aria-hidden />
          {p.appeal.status === "open"
            ? "Đang xem xét kháng nghị"
            : p.appeal.status === "overturned"
              ? "Kháng nghị được chấp nhận, đang duyệt lại"
              : "Kháng nghị không được chấp nhận"}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[560px] flex-col gap-2 border-t border-border bg-bg px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        {p.status === "passed" ? (
          <ButtonLink href={`/level-up/${p.proofId}`} className="w-full">
            Xem thành tích
          </ButtonLink>
        ) : p.status === "failed" ? (
          <div className="flex gap-2.5">
            <ButtonLink href={`/proof/new?skill=${p.skill.slug}`} className="flex-1">
              Thử lại
            </ButtonLink>
            {p.canAppeal ? (
              <AppealButton proofId={p.proofId} deadline={p.appealDeadline ? p.appealDeadline.toISOString() : null} />
            ) : null}
          </div>
        ) : (
          <ButtonLink href={`/skills/${p.skill.slug}`} variant="secondary" className="w-full">
            Về kỹ năng
          </ButtonLink>
        )}
      </div>
    </main>
  );
}

function StatusLine({ p }: { p: Status }) {
  const base = "inline-flex items-center gap-1.5 text-[15px] font-semibold";
  if (p.status === "passed")
    return (
      <p className={`${base} text-teal`}>
        <ShieldCheck size={18} aria-hidden />
        Đã xong mốc
      </p>
    );
  if (p.status === "failed")
    return (
      <p className={`${base} text-danger`}>
        <CircleX size={17} aria-hidden />
        Chưa đạt
      </p>
    );
  if (p.status === "removed") return <p className={`${base} text-muted`}>Đã gỡ</p>;
  return (
    <p className={`${base} text-muted`}>
      <Hourglass size={16} aria-hidden />
      {p.underEditorReview ? "Biên tập viên đang xem" : "Chờ duyệt"}
    </p>
  );
}

/** Tiến độ phiếu: mỗi người duyệt là một đoạn chỉ. */
function Votes({ votes, required }: { votes: number; required: number }) {
  return (
    <section aria-label="Tiến độ duyệt" className="mx-5 mt-6 flex flex-col gap-2.5">
      <ol className="flex gap-2" aria-hidden>
        {Array.from({ length: required }, (_, i) => (
          <li
            key={i}
            className={`h-2 flex-1 rounded-full ${i < votes ? "bg-teal" : "border border-dashed border-border-strong"}`}
          />
        ))}
      </ol>
      <div className="tabular flex items-center gap-1 text-[13px] text-muted">
        {votes}/{required} người đã duyệt
        <InfoSheet title="Ai xem video của bạn?" label="Cách chọn người duyệt">
          Người duyệt được chọn ngẫu nhiên trong số người đã xong các mốc cao của kỹ năng, không phải người bạn theo dõi, và không
          thấy tên bạn. Ai quá hạn sẽ được thay bằng người khác.
        </InfoSheet>
      </div>
    </section>
  );
}
