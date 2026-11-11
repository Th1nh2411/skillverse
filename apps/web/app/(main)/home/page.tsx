import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Flame, ShieldCheck } from "lucide-react";
import { getServerCaller } from "@/lib/server/trpc";
import { AppHeader } from "@/components/app-header";
import { InfoSheet } from "@/components/ui/sheet";
import { QuestList } from "./quest-list";
import { Feed } from "./feed";

export const metadata: Metadata = { title: "Trang chủ" };

export default async function HomePage() {
  const api = await getServerCaller();
  const [q, queue] = await Promise.all([api.home.quests(), api.review.queue().catch(() => null)]);
  const toReview = queue?.items.length ?? 0;

  return (
    <main className="flex flex-col">
      <AppHeader />

      {q.streak > 0 ? (
        <div className="flex items-center gap-1 px-5 pt-1">
          <p
            className={`tabular inline-flex items-center gap-1.5 text-[14px] font-semibold ${q.activeToday ? "text-accent" : "text-muted"}`}
          >
            <Flame size={18} aria-hidden />
            {q.streak} ngày liên tiếp
          </p>
          <InfoSheet title="Chuỗi ngày" label="Cách tính chuỗi ngày">
            Mỗi ngày hoàn thành ít nhất một nhiệm vụ để giữ chuỗi.
            {q.activeToday ? " Hôm nay bạn đã giữ chuỗi." : " Hôm nay bạn chưa giữ chuỗi."}
          </InfoSheet>
        </div>
      ) : null}

      {toReview > 0 ? (
        <Link
          href="/review"
          className="mx-5 mt-4 flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border border-teal/40 bg-teal-soft px-4 py-3 transition-colors hover:border-teal"
        >
          <ShieldCheck size={22} className="shrink-0 text-teal" aria-hidden />
          <span className="tabular flex-1 text-[15px] font-semibold">{toReview} bằng chứng cần bạn duyệt</span>
          <ChevronRight size={18} className="text-teal" aria-hidden />
        </Link>
      ) : null}

      <section aria-labelledby="quests" className="mx-5 mt-5 flex flex-col">
        <div className="flex items-baseline justify-between">
          <h2 id="quests" className="text-[17px] font-bold">
            Nhiệm vụ hôm nay
          </h2>
          <span className="tabular text-[14px] font-semibold text-muted">
            {q.completedCount}/{q.total}
          </span>
        </div>
        <QuestList quests={q.quests} />
      </section>

      <Feed />
    </main>
  );
}
