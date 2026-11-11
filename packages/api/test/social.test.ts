import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "@skillverse/domain/testing";
import { appRouter, createCallerFactory, createContext, createSessionFor, getSessionUser, type SessionUser } from "../src";
import { MemoryStorage } from "./helpers";

const db = getTestDb();
const createCaller = createCallerFactory(appRouter);
const caller = async (user: SessionUser | null) => createCaller(await createContext({ db, user, storage: new MemoryStorage() }));

let skill: FxSkill;
let alice: SessionUser;
let bob: SessionUser;
let editor: SessionUser;
const ID = "00000000-0000-4000-8000-000000000000";

async function viewer(userId: string): Promise<SessionUser> {
  return (await getSessionUser(db, (await createSessionFor(db, userId)).sessionToken))!;
}
async function expectCode(p: Promise<unknown>, code: TRPCError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof TRPCError && e.code === code);
}

beforeAll(async () => {
  await resetDb(db);
  const cat = await fx.category(db, { slug: "sinh-ton", name: "Sinh tồn" });
  skill = await fx.skill(db, { categoryId: cat.id, slug: "nhom-lua", name: "Nhóm lửa" });
  alice = await viewer((await fx.user(db, { handle: "alice", displayName: "Alice" })).id);
  bob = await viewer((await fx.user(db, { handle: "bob", displayName: "Bob" })).id);
  editor = await viewer((await fx.user(db, { handle: "bientap", isEditor: true })).id);
});

afterAll(async () => {
  await closeTestDb();
});

describe("quyền admin (editorProcedure)", () => {
  it("chưa đăng nhập → UNAUTHORIZED; người thường → FORBIDDEN", async () => {
    const anon = await caller(null);
    await expectCode(anon.admin.reports(), "UNAUTHORIZED");
    const c = await caller(alice);
    await expectCode(c.admin.reports(), "FORBIDDEN");
    await expectCode(c.admin.resolveReport({ reportId: ID, decision: "confirmed" }), "FORBIDDEN");
    await expectCode(c.admin.sanction({ userId: bob.id, kind: "warning", reason: "thử quyền" }), "FORBIDDEN");
    await expectCode(c.admin.userSanctions({ userId: bob.id }), "FORBIDDEN");
    await expectCode(c.admin.disputedProofs(), "FORBIDDEN");
    await expectCode(c.admin.resolveDisputedProof({ proofId: ID, decision: "clear" }), "FORBIDDEN");
    await expectCode(c.admin.appeals(), "FORBIDDEN");
    await expectCode(c.admin.resolveAppeal({ appealId: ID, decision: "upheld" }), "FORBIDDEN");
    await expectCode(
      c.admin.createDuel({ skillId: skill.id, metric: "Nhanh nhất", userA: alice.id, userB: bob.id, voteEndsAt: new Date(Date.now() + 86400000) }),
      "FORBIDDEN",
    );
  });

  it("biên tập viên: báo cáo → xác nhận/bác bỏ, xử phạt người dùng", async () => {
    const { reportId } = await (await caller(alice)).report.create({ targetType: "user", targetId: bob.id, reason: "harassment" });
    const ed = await caller(editor);
    const list = await ed.admin.reports();
    expect(list.items.map((r: { id: string }) => r.id)).toContain(reportId);
    const res = await ed.admin.resolveReport({ reportId, decision: "dismissed" });
    expect(res.status).toBe("dismissed");
    const s = await ed.admin.sanction({ userId: bob.id, kind: "post_ban", reason: "Spam nhiều lần", durationDays: 3 });
    expect(s.endsAt).toBeInstanceOf(Date);
    expect((await ed.admin.userSanctions({ userId: bob.id })).map((x: { kind: string }) => x.kind)).toContain("post_ban");
    // post_ban → domain chặn đăng bài
    await expect((await caller(bob)).post.create({ body: "Xin chào" })).rejects.toBeInstanceOf(TRPCError);
  });
});

describe("procedure xã hội: cần đăng nhập + validate", () => {
  it("chưa đăng nhập bị chặn", async () => {
    const c = await caller(null);
    await expectCode(c.home.quests(), "UNAUTHORIZED");
    await expectCode(c.home.feed(), "UNAUTHORIZED");
    await expectCode(c.post.create({ body: "x" }), "UNAUTHORIZED");
    await expectCode(c.challenge.list(), "UNAUTHORIZED");
    await expectCode(c.duel.get({ duelId: ID }), "UNAUTHORIZED");
    await expectCode(c.social.follow({ handle: "bob" }), "UNAUTHORIZED");
    await expectCode(c.message.threads(), "UNAUTHORIZED");
    await expectCode(c.notification.list(), "UNAUTHORIZED");
    await expectCode(c.report.create({ targetType: "user", targetId: ID, reason: "other" }), "UNAUTHORIZED");
  });

  it("input sai → BAD_REQUEST", async () => {
    const c = await caller(alice);
    await expectCode(c.post.create({ body: "   " }), "BAD_REQUEST");
    await expectCode(c.social.follow({ handle: "Sai Handle" }), "BAD_REQUEST");
    await expectCode(c.swap.rate({ swapId: ID, stars: 9 }), "BAD_REQUEST");
    await expectCode(c.message.send({ threadId: "x", body: "hi" }), "BAD_REQUEST");
  });

  it("follow theo handle, nhắn tin chỉ 2 thành viên, feed + nhiệm vụ ngày", async () => {
    const a = await caller(alice);
    expect(await a.social.follow({ handle: "bob" })).toMatchObject({ following: true, followerCount: 1 });
    await expectCode(a.social.follow({ handle: "khong_co_ai" }), "NOT_FOUND");
    const { threadId } = await a.message.open({ handle: "bob" });
    await a.message.send({ threadId, body: "Chào Bob" });
    const msgs = await (await caller(bob)).message.list({ threadId });
    expect(msgs.items[0]).toMatchObject({ body: "Chào Bob" });
    await expect((await caller(editor)).message.list({ threadId })).rejects.toBeInstanceOf(TRPCError);

    const post = await a.post.create({ body: "Hôm nay tập nhóm lửa", skillId: skill.id });
    expect(post.postId).toBeTruthy();
    const feed = await (await caller(bob)).home.feed();
    expect(feed.items.map((i: { id: string }) => i.id)).toContain(post.postId);
    const quests = await a.home.quests();
    expect(quests.total).toBeGreaterThan(0);
    expect((await (await caller(bob)).notification.list()).items.length).toBeGreaterThan(0);
  });
});
