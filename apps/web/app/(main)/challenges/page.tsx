import type { Metadata } from "next";
import { ChallengesView } from "./challenges-view";

export const metadata: Metadata = { title: "Thử thách" };

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initial = tab === "duels" || tab === "pending" ? tab : "active";
  return <ChallengesView initialTab={initial} />;
}
