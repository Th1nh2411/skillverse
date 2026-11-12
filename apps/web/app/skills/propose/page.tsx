import type { Metadata } from "next";
import { MILESTONE_DESCRIPTION_MAX, MILESTONE_TITLE_MAX, NEW_SKILL_MAX_LEVELS, NEW_SKILL_MIN_LEVELS } from "@skillverse/validation";
import { getServerCaller } from "@/lib/server/trpc";
import { NewSkillForm } from "./new-skill-form";

export const metadata: Metadata = { title: "Đề xuất kỹ năng" };

export default async function ProposeSkillPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  const api = await getServerCaller();
  const { categories } = await api.onboarding.options();
  return (
    <NewSkillForm
      initialName={name ?? ""}
      categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
      limits={{ minLevels: NEW_SKILL_MIN_LEVELS, maxLevels: NEW_SKILL_MAX_LEVELS, titleMax: MILESTONE_TITLE_MAX, descriptionMax: MILESTONE_DESCRIPTION_MAX }}
    />
  );
}
