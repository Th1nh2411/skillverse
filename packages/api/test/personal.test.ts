/** milestone.* (D73) và save.* (D74): xác thực, validate, chỉ thao tác dữ liệu của chính mình. */
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "@skillverse/domain/testing";
import { appRouter, createCallerFactory, createContext, createSessionFor, getSessionUser, type SessionUser } from "../src";
import { MemoryStorage } from "./helpers";

const db = getTestDb();
const createCaller = createCallerFactory(appRouter);
const caller = async (user: SessionUser | null) => createCaller(await createContext({ db, user, storage: new MemoryStorage() }));
const ID = "00000000-0000-4000-8000-000000000000";

let skill: FxSkill;
let me: SessionUser;
let other: SessionUser;

async function viewer(userId: string): Promise<SessionUser> {
  return (await getSessionUser(db, (await createSessionFor(db, userId)).sessionToken))!;
}
async function expectCode(p: Promise<unknown>, code: TRPCError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof TRPCError && e.code === code);
}

beforeAll(async () => {
  await resetDb(db);
  const cat = await fx.category(db, { slug: "ca-nhan", name: "Cá nhân" });
  skill = await fx.skill(db, { categoryId: cat.id, slug: "ca-nhan-kn", name: "Kỹ năng cá nhân" });
  me = await viewer((await fx.user(db, { handle: "toi_day" })).id);
  other = await viewer((await fx.user(db, { handle: "nguoi_khac" })).id);
});

afterAll(async () => {
  await closeTestDb();
});

describe("milestone.*", () => {
  it("chưa đăng nhập → UNAUTHORIZED; input sai → BAD_REQUEST", async () => {
    const anon = await caller(null);
    await expectCode(anon.milestone.check({ skillLevelId: skill.levels.get(1)!.levelId }), "UNAUTHORIZED");
    await expectCode(anon.milestone.uncheck({ skillLevelId: skill.levels.get(1)!.levelId }), "UNAUTHORIZED");
    await expectCode((await caller(me)).milestone.check({ skillLevelId: "khong-phai-uuid" }), "BAD_REQUEST");
  });

  it("đánh dấu theo thứ tự, bỏ đánh dấu mốc cao nhất; skill.detail phản ánh; level không đổi", async () => {
    const c = await caller(me);
    await expectCode(c.milestone.check({ skillLevelId: skill.levels.get(2)!.levelId }), "PRECONDITION_FAILED");
    expect(await c.milestone.check({ skillLevelId: skill.levels.get(1)!.levelId })).toMatchObject({ selfLevel: 1, verifiedLevel: 0 });
    expect(await c.milestone.check({ skillLevelId: skill.levels.get(2)!.levelId })).toMatchObject({ selfLevel: 2 });
    const d = await c.skill.detail({ slug: skill.slug });
    expect(d).toMatchObject({ myLevel: 0, selfLevel: 2, nextMilestone: { level: 3 } });
    expect(d.levels.filter((l) => l.checked).map((l) => l.level)).toEqual([1, 2]);
    // Người khác không thấy / không bỏ được dấu của tôi
    expect((await (await caller(other)).skill.detail({ slug: skill.slug })).selfLevel).toBe(0);
    await expectCode((await caller(other)).milestone.uncheck({ skillLevelId: skill.levels.get(2)!.levelId }), "NOT_FOUND");
    await expectCode(c.milestone.uncheck({ skillLevelId: skill.levels.get(1)!.levelId }), "PRECONDITION_FAILED");
    expect(await c.milestone.uncheck({ skillLevelId: skill.levels.get(2)!.levelId })).toMatchObject({ checked: false, selfLevel: 1 });
    expect((await db.userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId: me.id, skillId: skill.id } } })).level).toBe(0);
    await expectCode(c.milestone.check({ skillLevelId: ID }), "NOT_FOUND");
  });
});

describe("save.*", () => {
  it("chưa đăng nhập → UNAUTHORIZED; loại / id sai → BAD_REQUEST", async () => {
    const anon = await caller(null);
    await expectCode(anon.save.toggle({ targetType: "skill", targetId: skill.id }), "UNAUTHORIZED");
    await expectCode(anon.save.list(), "UNAUTHORIZED");
    const c = await caller(me);
    await expectCode(c.save.toggle({ targetType: "user" as "skill", targetId: skill.id }), "BAD_REQUEST");
    await expectCode(c.save.toggle({ targetType: "skill", targetId: "x" }), "BAD_REQUEST");
    await expectCode(c.save.list({ limit: 500 }), "BAD_REQUEST");
  });

  it("toggle + list chỉ của chính mình; không lưu được bằng chứng chưa công khai của người khác", async () => {
    const c = await caller(me);
    expect(await c.save.toggle({ targetType: "skill", targetId: skill.id })).toEqual({ saved: true });
    const post = await fx.post(db, { authorId: other.id, skillId: skill.id });
    expect(await c.save.toggle({ targetType: "post", targetId: post.id })).toEqual({ saved: true });
    const hidden = await fx.proof(db, { userId: other.id, skill, targetLevel: 1, status: "in_review" });
    await expectCode(c.save.toggle({ targetType: "proof", targetId: hidden.id }), "NOT_FOUND");

    const mine = await c.save.list();
    expect(mine.items.map((i) => i.targetId).sort()).toEqual([skill.id, post.id].sort());
    expect((await (await caller(other)).save.list()).items).toEqual([]);
    expect((await c.skill.detail({ slug: skill.slug })).saved).toBe(true);
    expect((await (await caller(other)).skill.detail({ slug: skill.slug })).saved).toBe(false);
    expect(await c.save.toggle({ targetType: "skill", targetId: skill.id })).toEqual({ saved: false });
    expect((await c.save.list()).items.map((i) => i.targetType)).toEqual(["post"]);
  });
});
