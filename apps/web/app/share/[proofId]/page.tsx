import type { Metadata } from "next";
import { cache } from "react";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { ShareCard } from "@/components/share-card";
import { ButtonLink } from "@/components/ui/button";
import { milestoneName } from "@/lib/milestone";

type Params = { params: Promise<{ proofId: string }> };

/** Trang công khai: không cần đăng nhập, chỉ tên hiển thị + kỹ năng/mốc. Ảnh OG do api vẽ. */
const loadCard = cache(async (proofId: string) => {
  const api = await getServerCaller();
  return api.share.card({ proofId });
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { proofId } = await params;
  const card = await loadCard(proofId).catch(() => null);
  if (!card) return { title: "Thành tích" };
  const title = `${card.displayName} xong mốc ${milestoneName(card.levelTitle, card.level)}, ${card.skill.name}`;
  const description = `Được ${card.verifiedCount} người trên SkillVerse công nhận.`;
  const image = { url: `/og/level-up/${card.proofId}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    openGraph: { title, description, type: "article", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function SharePage({ params }: Params) {
  const { proofId } = await params;
  const card = await orNotFound(loadCard(proofId));
  const milestone = milestoneName(card.levelTitle, card.level);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[10vh]">
      <h1 className="sr-only">
        {card.displayName} xong mốc {milestone}, {card.skill.name}
      </h1>
      <ShareCard
        size="lg"
        displayName={card.displayName}
        skillSlug={card.skill.slug}
        skillName={card.skill.name}
        categorySlug={card.skill.category.slug}
        rarity={card.rarity}
        milestone={milestone}
        verifiedCount={card.verifiedCount}
      />
      <p className="mt-6 text-[15px] leading-relaxed text-muted">
        Trên SkillVerse, mỗi kỹ năng là vài mốc nhỏ. Quay video, bạn bè công nhận, khoe ngay.
      </p>
      <div className="mt-auto flex flex-col gap-2.5 pt-8">
        <ButtonLink href={`/skills/${card.skill.slug}`} className="w-full">
          Thử kỹ năng này
        </ButtonLink>
      </div>
    </main>
  );
}
