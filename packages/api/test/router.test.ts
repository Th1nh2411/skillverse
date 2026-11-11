import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "@skillverse/domain/testing";
import {
  appRouter,
  createCallerFactory,
  createContext,
  createContextFromHeaders,
  createSessionFor,
  getSessionUser,
  type SessionUser,
} from "../src";

const db = getTestDb();
const createCaller = createCallerFactory(appRouter);
const caller = async (user: SessionUser | null) => createCaller(await createContext({ db, user }));

let viewer: SessionUser;
let fresh: SessionUser;
let freshToken: string;
let skills: FxSkill[];
const catSlug = "sinh-ton";

async function expectCode(p: Promise<unknown>, code: TRPCError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof TRPCError && e.code === code);
}

beforeAll(async () => {
  await resetDb(db);
  const cat = await fx.category(db, { slug: catSlug, name: "Sinh tồn" });
  skills = [];
  for (const [i, name] of ["Thắt nút dây", "Sơ cứu", "Nhóm lửa", "Huýt sáo bằng lá"].entries()) {
    skills.push(await fx.skill(db, { categoryId: cat.id, slug: `ky-nang-${i}`, name, holderCount: [960, 1200, 640, 41][i] }));
  }
  await fx.edge(db, skills[1]!.id, skills[2]!.id, 2);

  const u = await fx.user(db, { handle: "minhhoang", displayName: "Minh Hoàng" });
  await fx.setUserSkillLevel(db, u.id, skills[0]!.id, 3);
  viewer = (await getSessionUser(db, (await createSessionFor(db, u.id)).sessionToken))!;

  const n = await fx.user(db, { handle: "nguoimoi", onboarded: false });
  freshToken = (await createSessionFor(db, n.id)).sessionToken;
  fresh = (await getSessionUser(db, freshToken))!;
});

afterAll(async () => {
  await closeTestDb();
});

describe("quyền: chưa đăng nhập bị chặn", () => {
  it("me trả null, health công khai", async () => {
    const c = await caller(null);
    expect(await c.me()).toBeNull();
    expect(await c.health()).toEqual({ ok: true });
  });

  it("mọi procedure giai đoạn 1 trả UNAUTHORIZED", async () => {
    const c = await caller(null);
    await expectCode(c.skill.tree({ categorySlug: catSlug }), "UNAUTHORIZED");
    await expectCode(c.skill.detail({ slug: "ky-nang-0" }), "UNAUTHORIZED");
    await expectCode(c.skill.search({ query: "nut" }), "UNAUTHORIZED");
    await expectCode(c.discover.home(), "UNAUTHORIZED");
    await expectCode(c.profile.me(), "UNAUTHORIZED");
    await expectCode(c.profile.byHandle({ handle: "minhhoang" }), "UNAUTHORIZED");
    await expectCode(c.onboarding.options(), "UNAUTHORIZED");
    await expectCode(c.onboarding.complete({ skillIds: skills.slice(0, 3).map((s) => s.id) }), "UNAUTHORIZED");
  });

  it("token rác / hết hạn qua header → coi như chưa đăng nhập", async () => {
    const ctx = await createContextFromHeaders(new Headers({ authorization: "Bearer khong-hop-le" }), db);
    expect(ctx.user).toBeNull();
    await expectCode(createCaller(ctx).profile.me(), "UNAUTHORIZED");
  });
});

describe("validate input (Zod)", () => {
  it("slug / handle / query sai → BAD_REQUEST", async () => {
    const c = await caller(viewer);
    await expectCode(c.skill.tree({ categorySlug: "Sai Slug!" }), "BAD_REQUEST");
    await expectCode(c.skill.detail({ slug: "" }), "BAD_REQUEST");
    await expectCode(c.skill.search({ query: "   " }), "BAD_REQUEST");
    await expectCode(c.skill.search({ query: "nut", limit: 500 }), "BAD_REQUEST");
    await expectCode(c.profile.byHandle({ handle: "A B" }), "BAD_REQUEST");
  });

  it("onboarding.complete: < 3 kỹ năng, id trùng, id không phải uuid → BAD_REQUEST", async () => {
    const c = await caller(fresh);
    await expectCode(c.onboarding.complete({ skillIds: [skills[0]!.id, skills[1]!.id] }), "BAD_REQUEST");
    await expectCode(c.onboarding.complete({ skillIds: [skills[0]!.id, skills[0]!.id, skills[1]!.id] }), "BAD_REQUEST");
    await expectCode(c.onboarding.complete({ skillIds: ["a", "b", "c"] }), "BAD_REQUEST");
  });
});

describe("router gọi domain", () => {
  it("Bearer token (mobile) phân giải đúng người dùng", async () => {
    const ctx = await createContextFromHeaders(new Headers({ authorization: `Bearer ${freshToken}` }), db);
    expect(ctx.user?.id).toBe(fresh.id);
    expect(await createCaller(ctx).me()).toMatchObject({ handle: "nguoimoi", onboarded: false });
  });

  it("profile.me / profile.byHandle", async () => {
    const c = await caller(viewer);
    const me = await c.profile.me();
    expect(me).toMatchObject({ handle: "minhhoang" });
    expect(await c.profile.byHandle({ handle: "nguoimoi" })).toMatchObject({ handle: "nguoimoi" });
    await expectCode(c.profile.byHandle({ handle: "khong_co_ai" }), "NOT_FOUND");
    expect((await c.profile.skills({ handle: "minhhoang" })).map((s) => s.level)).toEqual([3]);
    await expectCode((await caller(null)).profile.skills({ handle: "minhhoang" }), "UNAUTHORIZED");
  });

  it("skill.tree / detail / search; DomainError NOT_FOUND map sang mã tRPC", async () => {
    const c = await caller(viewer);
    const tree = await c.skill.tree({ categorySlug: catSlug });
    expect(tree).toBeTruthy();
    expect(await c.skill.detail({ slug: "ky-nang-0" })).toMatchObject({ slug: "ky-nang-0" });
    await expectCode(c.skill.detail({ slug: "khong-co" }), "NOT_FOUND");
    await expectCode(c.skill.tree({ categorySlug: "khong-co" }), "NOT_FOUND");
    const found = await c.skill.search({ query: "Sơ cứu" });
    expect(found.map((s) => s.name)).toContain("Sơ cứu");
  });

  it("discover.home trả đủ 4 khối", async () => {
    const c = await caller(viewer);
    const home = await c.discover.home();
    expect(Object.keys(home).sort()).toEqual(["categories", "nearby", "rarest", "trending"]);
    expect(home.categories.map((x) => x.slug)).toContain(catSlug);
  });

  it("onboarding: options + complete đặt onboarded", async () => {
    const c = await caller(fresh);
    const opts = await c.onboarding.options();
    expect(opts).toBeTruthy();
    await c.onboarding.complete({ skillIds: skills.slice(0, 3).map((s) => s.id), selfLevels: { [skills[0]!.id]: "some" } });
    expect((await getSessionUser(db, freshToken))?.onboarded).toBe(true);
  });
});
