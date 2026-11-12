import type { Metadata } from "next";
import { getServerCaller } from "@/lib/server/trpc";
import { BackButton } from "@/components/ui/back-button";
import { EmptyState } from "@/components/ui/misc";
import { TrailArt } from "@/components/illustrations";
import { SwapCard } from "./swap-card";

export const metadata: Metadata = { title: "Trao đổi kỹ năng" };

export default async function SwapsPage() {
  const api = await getServerCaller();
  const swaps = await api.swap.list();
  const open = swaps.filter((s) => s.status === "proposed" || s.status === "accepted");
  const past = swaps.filter((s) => s.status === "done" || s.status === "cancelled");

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-10">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/profile" />
        <h1 className="font-display text-[22px] font-extrabold">Trao đổi kỹ năng</h1>
      </header>
      {swaps.length === 0 ? (
        <div className="px-5 pt-4">
          <EmptyState art={<TrailArt size={140} />} title="Chưa có đề nghị trao đổi nào" />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 px-5 pt-3">
            {open.map((s) => (
              <SwapCard key={s.id} swap={{ ...s, scheduledAt: s.scheduledAt?.toISOString() ?? null }} />
            ))}
          </ul>
          {past.length > 0 ? (
            <section aria-labelledby="past" className="mt-6 flex flex-col gap-3 px-5">
              <h2 id="past" className="text-[15px] font-bold text-muted">
                Đã xong
              </h2>
              <ul className="flex flex-col gap-3">
                {past.map((s) => (
                  <SwapCard key={s.id} swap={{ ...s, scheduledAt: s.scheduledAt?.toISOString() ?? null }} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
