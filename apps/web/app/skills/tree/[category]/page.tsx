import type { Metadata } from "next";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { SkillTreeView } from "./skill-tree-view";

export const metadata: Metadata = { title: "Cây kỹ năng" };

export default async function SkillTreePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const api = await getServerCaller();
  const tree = await orNotFound(api.skill.tree({ categorySlug: category }));
  return <SkillTreeView tree={tree} />;
}
