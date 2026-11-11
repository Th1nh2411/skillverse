import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { BackButton } from "@/components/ui/back-button";
import { EmptyState } from "@/components/ui/misc";
import { SuggestForm } from "./suggest-form";

export const metadata: Metadata = { title: "Góp ý tiêu chí" };

export default async function SuggestCriteriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const api = await getServerCaller();
  const d = await orNotFound(api.skill.detail({ slug }));
  // skill.detail chưa chắc có skillLevelId (đã nhờ domain thêm) → đọc an toàn.
  const levels = d.levels.flatMap((lv) => {
    const id = "skillLevelId" in lv && typeof lv.skillLevelId === "string" ? lv.skillLevelId : null;
    return id ? [{ id, level: lv.level, criteria: lv.criteria.map((c) => c.text) }] : [];
  });
  const initial = Number(sp.level) || (d.myLevel ?? 0) + 1;

  return levels.length === 0 ? (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback={`/skills/${slug}`} />
        <h1 className="font-display text-[22px] font-extrabold">Góp ý tiêu chí</h1>
      </header>
      <div className="px-5 pt-4">
        <EmptyState icon={Wrench} title="Chưa góp ý được cho kỹ năng này" />
      </div>
    </main>
  ) : (
    <SuggestForm skill={{ slug, name: d.name }} levels={levels} initialLevel={initial} />
  );
}
