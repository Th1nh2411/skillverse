import type { Prisma, RiskLevel } from "@skillverse/db";
import { getRarityThresholds, type RarityThresholds } from "./config";
import type { Db } from "./db";
import { rarityOf, type Rarity } from "./rarity";

export type SkillSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: { slug: string; name: string };
  riskLevel: RiskLevel;
  maxLevel: number;
  holderCount: number;
  rarity: Rarity;
};

const summarySelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  riskLevel: true,
  maxLevel: true,
  holderCount: true,
  category: { select: { slug: true, name: true } },
} satisfies Prisma.SkillSelect;

type SummaryRow = Prisma.SkillGetPayload<{ select: typeof summarySelect }>;

function toSummary(s: SummaryRow, t: RarityThresholds): SkillSummary {
  return { ...s, rarity: rarityOf(s.holderCount, t) };
}

/** Bỏ dấu tiếng Việt, chữ thường — dùng để so khớp với slug (slug không dấu). */
export function normalizeVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export async function listCategories(db: Db): Promise<{ id: string; slug: string; name: string; skillCount: number }[]> {
  const cats = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { skills: { where: { status: "active" } } } } },
  });
  return cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, skillCount: c._count.skills }));
}

/** Tìm kỹ năng đang hoạt động theo tên (có dấu, không phân biệt hoa thường) hoặc slug (gõ không dấu). */
export async function searchSkills(
  db: Db,
  input: { query: string; categorySlug?: string; limit?: number },
): Promise<SkillSummary[]> {
  const q = input.query.trim();
  if (!q) return [];
  const slugQ = normalizeVi(q).replace(/\s+/g, "-");
  const rows = await db.skill.findMany({
    where: {
      status: "active",
      ...(input.categorySlug ? { category: { slug: input.categorySlug } } : {}),
      OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: slugQ } }],
    },
    orderBy: [{ holderCount: "desc" }, { name: "asc" }],
    take: input.limit ?? 20,
    select: summarySelect,
  });
  const t = await getRarityThresholds(db);
  return rows.map((r) => toSummary(r, t));
}

/** Kỹ năng hiếm nhất: holder_count nhỏ nhất (> 0, vì 0 nghĩa là chưa ai đạt). */
export async function rarestSkills(
  db: Db,
  input: { categorySlug?: string; limit?: number } = {},
): Promise<SkillSummary[]> {
  const rows = await db.skill.findMany({
    where: {
      status: "active",
      holderCount: { gt: 0 },
      ...(input.categorySlug ? { category: { slug: input.categorySlug } } : {}),
    },
    orderBy: [{ holderCount: "asc" }, { name: "asc" }],
    take: input.limit ?? 10,
    select: summarySelect,
  });
  const t = await getRarityThresholds(db);
  return rows.map((r) => toSummary(r, t));
}

export type TrendingSkill = SkillSummary & {
  /** Số bằng chứng + bài đăng trong 7 ngày gần nhất. */
  activityThisWeek: number;
  /** Cùng chỉ số trong 7 ngày trước đó. */
  activityLastWeek: number;
  /** Phần trăm tăng trưởng làm tròn; tuần trước = 0 thì so với 1. */
  growthPercent: number;
};

const DAY_MS = 86_400_000;

/** Thịnh hành: tăng trưởng (proofs + posts) 7 ngày gần nhất so với 7 ngày trước đó. */
export async function trendingSkills(
  db: Db,
  input: { categorySlug?: string; limit?: number; now?: Date } = {},
): Promise<TrendingSkill[]> {
  const now = input.now ?? new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);
  const skillFilter = {
    status: "active" as const,
    ...(input.categorySlug ? { category: { slug: input.categorySlug } } : {}),
  };

  const count = async (from: Date, to: Date) => {
    const range = { gte: from, lt: to };
    const [proofs, posts] = await Promise.all([
      db.proof.groupBy({
        by: ["skillId"],
        where: { createdAt: range, deletedAt: null, skill: skillFilter },
        _count: { _all: true },
      }),
      db.post.groupBy({
        by: ["skillId"],
        where: { createdAt: range, deletedAt: null, skillId: { not: null }, skill: skillFilter },
        _count: { _all: true },
      }),
    ]);
    const m = new Map<string, number>();
    for (const r of proofs) m.set(r.skillId, (m.get(r.skillId) ?? 0) + r._count._all);
    for (const r of posts) if (r.skillId) m.set(r.skillId, (m.get(r.skillId) ?? 0) + r._count._all);
    return m;
  };
  const [cur, prev] = await Promise.all([count(weekAgo, now), count(twoWeeksAgo, weekAgo)]);

  const scored = [...cur.entries()]
    .map(([skillId, a]) => {
      const b = prev.get(skillId) ?? 0;
      return { skillId, a, b, growth: Math.round(((a - b) / Math.max(b, 1)) * 100) };
    })
    .filter((x) => x.a > 0 && x.growth > 0)
    .sort((x, y) => y.growth - x.growth || y.a - x.a)
    .slice(0, input.limit ?? 10);
  if (scored.length === 0) return [];

  const rows = await db.skill.findMany({ where: { id: { in: scored.map((s) => s.skillId) } }, select: summarySelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const t = await getRarityThresholds(db);
  return scored.flatMap((s) => {
    const r = byId.get(s.skillId);
    return r ? [{ ...toSummary(r, t), activityThisWeek: s.a, activityLastWeek: s.b, growthPercent: s.growth }] : [];
  });
}

export type NearbyPerson = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  accountLevel: number;
  topSkills: { slug: string; name: string; level: number }[];
};

export type NearbyPeople = {
  /** false khi người xem chưa bật chia sẻ vị trí — UI mời bật, không có danh sách. */
  enabled: boolean;
  total: number;
  people: NearbyPerson[];
};

/**
 * Người gần bạn: cùng ô lưới home_cell, cả hai đều share_location = true.
 * KHÔNG trả về home_cell hay bất kỳ dữ liệu vị trí nào.
 * `skillSlug`: chỉ người đã đạt cấp ≥ 1 kỹ năng đó.
 */
export async function nearbyPeople(
  db: Db,
  input: { userId: string; skillSlug?: string; limit?: number },
): Promise<NearbyPeople> {
  const me = await db.user.findUnique({ where: { id: input.userId }, select: { homeCell: true, shareLocation: true } });
  if (!me || !me.shareLocation || !me.homeCell) return { enabled: false, total: 0, people: [] };

  const where: Prisma.UserWhereInput = {
    id: { not: input.userId },
    homeCell: me.homeCell,
    shareLocation: true,
    status: "active",
    deletedAt: null,
    ...(input.skillSlug ? { userSkills: { some: { level: { gte: 1 }, skill: { slug: input.skillSlug } } } } : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ accountLevel: "desc" }, { handle: "asc" }],
      take: input.limit ?? 10,
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        accountLevel: true,
        userSkills: {
          where: { level: { gte: 1 }, skill: { status: "active" } },
          orderBy: { level: "desc" },
          take: 3,
          select: { level: true, skill: { select: { slug: true, name: true } } },
        },
      },
    }),
  ]);
  return {
    enabled: true,
    total,
    people: users.map((u) => ({
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      accountLevel: u.accountLevel,
      topSkills: u.userSkills.map((us) => ({ slug: us.skill.slug, name: us.skill.name, level: us.level })),
    })),
  };
}
