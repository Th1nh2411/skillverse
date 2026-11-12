import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listCategories, nearbyPeople, rarestSkills, searchSkills, trendingSkills } from "../src";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "../src/testing";

const db = getTestDb();
const NOW = new Date("2026-11-11T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

let fire: FxSkill, rubik: FxSkill, glass: FxSkill, knit: FxSkill, archived: FxSkill;
let catOdd: string;

beforeAll(async () => {
  await resetDb(db);
  const survival = await fx.category(db, { slug: "sinh-ton", name: "Sinh tồn" });
  const odd = await fx.category(db, { slug: "ky-nang-di", name: "Kỹ năng dị" });
  catOdd = odd.slug;
  fire = await fx.skill(db, { categoryId: survival.id, slug: "lua-bang-que", name: "Lửa bằng que", holderCount: 214 });
  knit = await fx.skill(db, { categoryId: survival.id, slug: "dan-len", name: "Đan len", holderCount: 900 });
  rubik = await fx.skill(db, { categoryId: odd.id, slug: "giai-rubik", name: "Giải rubik bịt mắt", holderCount: 64 });
  glass = await fx.skill(db, { categoryId: odd.id, slug: "thoi-thuy-tinh", name: "Thổi thủy tinh", holderCount: 12 });
  await fx.skill(db, { categoryId: odd.id, slug: "chua-ai-dat", name: "Chưa ai đạt", holderCount: 0 });
  archived = await fx.skill(db, { categoryId: odd.id, slug: "luu-tru", name: "Lửa lưu trữ", holderCount: 1, status: "archived" });
});

afterAll(async () => {
  await closeTestDb();
});

describe("searchSkills", () => {
  it("tìm theo tên có dấu, không phân biệt hoa thường", async () => {
    const r = await searchSkills(db, { query: "LỬA" });
    expect(r.map((s) => s.slug)).toEqual(["lua-bang-que"]);
    expect(r[0]).toMatchObject({ rarity: "rare", category: { slug: "sinh-ton", name: "Sinh tồn" } });
  });
  it("gõ không dấu khớp qua slug", async () => {
    expect((await searchSkills(db, { query: "lua bang" })).map((s) => s.slug)).toEqual(["lua-bang-que"]);
    expect((await searchSkills(db, { query: "dan" })).map((s) => s.slug)).toContain("dan-len");
  });
  it("lọc danh mục, bỏ kỹ năng không active, chuỗi rỗng → []", async () => {
    expect(await searchSkills(db, { query: "lửa", categorySlug: catOdd })).toEqual([]);
    expect((await searchSkills(db, { query: "lưu trữ" })).length).toBe(0);
    expect(await searchSkills(db, { query: "   " })).toEqual([]);
  });
});

describe("rarestSkills", () => {
  it("holder_count tăng dần, bỏ 0 và kỹ năng archived", async () => {
    const r = await rarestSkills(db, { limit: 3 });
    expect(r.map((s) => s.slug)).toEqual(["thoi-thuy-tinh", "giai-rubik", "lua-bang-que"]);
    expect(r.map((s) => s.rarity)).toEqual(["legendary", "rare", "rare"]);
    expect(r.find((s) => s.id === archived.id)).toBeUndefined();
  });
  it("lọc theo danh mục", async () => {
    const r = await rarestSkills(db, { categorySlug: "sinh-ton" });
    expect(r.map((s) => s.slug)).toEqual(["lua-bang-que", "dan-len"]);
  });
});

describe("trendingSkills", () => {
  it("tăng trưởng proofs + posts 7 ngày so với 7 ngày trước", async () => {
    const u = (await fx.user(db)).id;
    // rubik: tuần này 4 (3 proof + 1 post), tuần trước 1 → +300%
    for (const d of [1, 2, 3]) await fx.proof(db, { userId: u, skill: rubik, targetLevel: 1, createdAt: daysAgo(d), status: "failed" });
    await fx.post(db, { authorId: u, skillId: rubik.id, createdAt: daysAgo(1) });
    await fx.post(db, { authorId: u, skillId: rubik.id, createdAt: daysAgo(10) });
    // glass: tuần này 2, tuần trước 0 → +200% (so với 1)
    await fx.post(db, { authorId: u, skillId: glass.id, createdAt: daysAgo(2) });
    await fx.post(db, { authorId: u, skillId: glass.id, createdAt: daysAgo(3) });
    // knit: tuần này 1, tuần trước 2 → giảm, không thịnh hành
    await fx.post(db, { authorId: u, skillId: knit.id, createdAt: daysAgo(1) });
    await fx.post(db, { authorId: u, skillId: knit.id, createdAt: daysAgo(8) });
    await fx.post(db, { authorId: u, skillId: knit.id, createdAt: daysAgo(9) });
    // fire: chỉ có hoạt động cũ hơn 14 ngày
    await fx.post(db, { authorId: u, skillId: fire.id, createdAt: daysAgo(20) });

    const r = await trendingSkills(db, { now: NOW });
    expect(r.map((s) => [s.slug, s.activityThisWeek, s.activityLastWeek, s.growthPercent])).toEqual([
      ["giai-rubik", 4, 1, 300],
      ["thoi-thuy-tinh", 2, 0, 200],
    ]);
    expect(await trendingSkills(db, { now: NOW, categorySlug: "sinh-ton" })).toEqual([]);
  });
});

describe("listCategories", () => {
  it("đếm kỹ năng active", async () => {
    const cats = await listCategories(db);
    expect(cats.find((c) => c.slug === "ky-nang-di")?.skillCount).toBe(3);
  });
});

describe("nearbyPeople", () => {
  it("cùng ô lưới, chỉ người share_location; không lộ vị trí", async () => {
    const me = await fx.user(db, { homeCell: "cell-A", shareLocation: true });
    const a = await fx.user(db, { homeCell: "cell-A", shareLocation: true, handle: "gan_a" });
    await fx.user(db, { homeCell: "cell-A", shareLocation: false, handle: "an_vitri" });
    await fx.user(db, { homeCell: "cell-B", shareLocation: true, handle: "xa_b" });
    await fx.user(db, { homeCell: "cell-A", shareLocation: true, handle: "bi_khoa", status: "banned" });
    const b = await fx.user(db, { homeCell: "cell-A", shareLocation: true, handle: "gan_b" });
    await fx.setUserSkillLevel(db, a.id, rubik.id, 3);
    await fx.setUserSkillLevel(db, b.id, rubik.id, 0);

    const r = await nearbyPeople(db, { userId: me.id });
    expect(r.enabled).toBe(true);
    expect(r.total).toBe(2);
    expect(r.people.map((p) => p.handle).sort()).toEqual(["gan_a", "gan_b"]);
    expect(JSON.stringify(r)).not.toContain("cell-A");
    expect(r.people.find((p) => p.handle === "gan_a")?.topSkills).toEqual([
      { slug: "giai-rubik", name: "Giải rubik bịt mắt", level: 3, levelTitle: "Cấp 3" },
    ]);

    const bySkill = await nearbyPeople(db, { userId: me.id, skillSlug: "giai-rubik" });
    expect(bySkill.people.map((p) => p.handle)).toEqual(["gan_a"]);
  });

  it("người xem chưa bật chia sẻ vị trí → enabled=false, không danh sách", async () => {
    const me = await fx.user(db, { homeCell: "cell-A", shareLocation: false });
    expect(await nearbyPeople(db, { userId: me.id })).toEqual({ enabled: false, total: 0, people: [] });
  });
});
