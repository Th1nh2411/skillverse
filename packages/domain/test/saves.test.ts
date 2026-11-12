/** D74 — lưu bài viết / kỹ năng / bằng chứng: CRUD, hiển thị, bỏ qua mục bị ẩn, cờ `saved` trên các view. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getHomeFeed,
  getProofStatus,
  getShareCard,
  getSkillDetail,
  listSaved,
  setSaved,
  toggleSave,
} from "../src";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "../src/testing";

const db = getTestDb();
let skill: FxSkill;
let me: { id: string };
let other: { id: string; displayName: string };

beforeAll(async () => {
  await resetDb(db);
  const cat = await fx.category(db, { slug: "luu-t", name: "Lưu" });
  skill = await fx.skill(db, { categoryId: cat.id, slug: "luu-ky-nang", name: "Kỹ năng lưu" });
  me = await fx.user(db);
  other = await fx.user(db);
});

afterAll(async () => {
  await closeTestDb();
});

describe("lưu", () => {
  it("toggle / set idempotent; danh sách mới nhất trước, có dữ liệu hiển thị, phân trang", async () => {
    const post = await fx.post(db, { authorId: other.id, skillId: skill.id });
    const proof = await fx.proof(db, { userId: other.id, skill, targetLevel: 2, status: "passed" });
    const t0 = new Date("2026-11-01T00:00:00Z");
    await setSaved(db, { userId: me.id, targetType: "skill", targetId: skill.id, saved: true, now: t0 });
    await setSaved(db, { userId: me.id, targetType: "post", targetId: post.id, saved: true, now: new Date(t0.getTime() + 1000) });
    expect(await toggleSave(db, { userId: me.id, targetType: "proof", targetId: proof.id, now: new Date(t0.getTime() + 2000) })).toEqual({
      saved: true,
    });
    // set lại không nhân đôi
    await setSaved(db, { userId: me.id, targetType: "skill", targetId: skill.id, saved: true });
    expect(await db.save.count({ where: { userId: me.id } })).toBe(3);

    const all = await listSaved(db, { userId: me.id });
    expect(all.items.map((i) => i.targetType)).toEqual(["proof", "post", "skill"]);
    expect(all.nextCursor).toBeNull();
    const [pr, po, sk] = all.items;
    expect(pr).toMatchObject({
      targetType: "proof",
      proof: { proofId: proof.id, isMine: false, displayName: other.displayName, level: 2, levelTitle: "Cấp 2", skill: { slug: skill.slug } },
    });
    expect(JSON.stringify(pr)).not.toContain(other.id);
    expect(po).toMatchObject({ targetType: "post", post: { id: post.id, author: { displayName: other.displayName }, skill: { slug: skill.slug } } });
    expect(sk).toMatchObject({ targetType: "skill", skill: { id: skill.id, slug: skill.slug, maxLevel: 5 } });

    const p1 = await listSaved(db, { userId: me.id, limit: 2 });
    expect(p1.items.map((i) => i.targetType)).toEqual(["proof", "post"]);
    const p2 = await listSaved(db, { userId: me.id, limit: 2, cursor: p1.nextCursor });
    expect(p2.items.map((i) => i.targetType)).toEqual(["skill"]);
    expect(p2.nextCursor).toBeNull();
    await expect(listSaved(db, { userId: me.id, cursor: "rac" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Danh sách là của riêng từng người
    expect((await listSaved(db, { userId: other.id })).items).toEqual([]);

    expect(await toggleSave(db, { userId: me.id, targetType: "proof", targetId: proof.id })).toEqual({ saved: false });
    expect(await db.save.count({ where: { userId: me.id, targetType: "proof" } })).toBe(0);
  });

  it("không lưu được mục không hiển thị; mục bị ẩn sau khi lưu bị bỏ qua khi liệt kê", async () => {
    const u = await fx.user(db);
    const pending = await fx.proof(db, { userId: other.id, skill, targetLevel: 1, status: "in_review" });
    await expect(setSaved(db, { userId: u.id, targetType: "proof", targetId: pending.id, saved: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const mine = await fx.proof(db, { userId: u.id, skill, targetLevel: 1, status: "in_review" });
    await setSaved(db, { userId: u.id, targetType: "proof", targetId: mine.id, saved: true });
    await expect(
      setSaved(db, { userId: u.id, targetType: "post", targetId: "00000000-0000-4000-8000-000000000000", saved: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const post = await fx.post(db, { authorId: other.id, skillId: skill.id });
    const archived = await fx.skill(db, { categoryId: (await fx.category(db)).id });
    await setSaved(db, { userId: u.id, targetType: "post", targetId: post.id, saved: true });
    await setSaved(db, { userId: u.id, targetType: "skill", targetId: archived.id, saved: true });
    expect((await listSaved(db, { userId: u.id })).items).toHaveLength(3);

    await db.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });
    await db.skill.update({ where: { id: archived.id }, data: { status: "archived" } });
    const after = await listSaved(db, { userId: u.id });
    expect(after.items.map((i) => i.targetType)).toEqual(["proof"]);
    expect(after.items[0]).toMatchObject({ proof: { isMine: true, status: "in_review" } });
    // Bỏ lưu vẫn được khi mục đã bị ẩn
    expect(await setSaved(db, { userId: u.id, targetType: "post", targetId: post.id, saved: false })).toEqual({ saved: false });
  });

  it("cờ saved trên feed, chi tiết kỹ năng, trạng thái bằng chứng, thẻ chia sẻ", async () => {
    const u = await fx.user(db);
    const post = await fx.post(db, { authorId: u.id, skillId: skill.id });
    const proof = await fx.proof(db, { userId: u.id, skill, targetLevel: 1, status: "passed" });
    const flags = async () => ({
      feed: (await getHomeFeed(db, { userId: u.id })).items.find((i) => i.id === post.id)?.saved,
      skill: (await getSkillDetail(db, { slug: skill.slug, userId: u.id })).saved,
      status: (await getProofStatus(db, { proofId: proof.id, userId: u.id })).saved,
      share: (await getShareCard(db, { proofId: proof.id, viewerId: u.id })).saved,
    });
    expect(await flags()).toEqual({ feed: false, skill: false, status: false, share: false });
    await toggleSave(db, { userId: u.id, targetType: "post", targetId: post.id });
    await toggleSave(db, { userId: u.id, targetType: "skill", targetId: skill.id });
    await toggleSave(db, { userId: u.id, targetType: "proof", targetId: proof.id });
    expect(await flags()).toEqual({ feed: true, skill: true, status: true, share: true });
    expect((await getShareCard(db, { proofId: proof.id })).saved).toBe(false);
    expect((await getSkillDetail(db, { slug: skill.slug, userId: other.id })).saved).toBe(false);
  });
});
