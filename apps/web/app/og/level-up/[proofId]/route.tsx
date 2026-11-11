/**
 * Ảnh OG 1200x630 cho thẻ chia sẻ lên cấp: /og/level-up/<proofId>
 * Công khai (proxy bỏ qua /og), chỉ cho bằng chứng đã đạt; dữ liệu duy nhất về người là tên hiển thị.
 */
import { DomainError, getShareCard } from "@skillverse/domain";
import { getPrisma } from "@skillverse/db";
import { proofIdInput } from "@skillverse/validation";
import { renderLevelUpCard } from "../../_lib/card";

export async function GET(_req: Request, ctx: { params: Promise<{ proofId: string }> }) {
  const parsed = proofIdInput.safeParse({ proofId: (await ctx.params).proofId });
  if (!parsed.success) return new Response("Not found", { status: 404 });
  try {
    const card = await getShareCard(getPrisma(), { proofId: parsed.data.proofId });
    return await renderLevelUpCard({
      displayName: card.displayName,
      skillName: card.skill.name,
      categorySlug: card.skill.category.slug,
      categoryName: card.skill.category.name,
      level: card.level,
      levelTitle: card.levelTitle,
      maxLevel: card.maxLevel,
      rarity: card.rarity,
    });
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") return new Response("Not found", { status: 404 });
    throw e;
  }
}
