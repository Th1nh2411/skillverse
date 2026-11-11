import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { closeE2eDb, e2eDb } from "./helpers/db";
import { gotoScreen } from "./helpers/nav";
import { devToken, skipIfNoProcedure, trpcMutation, trpcQuery } from "./helpers/trpc";

/**
 * Giai đoạn 3 — Xã hội (qua API trước; phần màn hình skip có điều kiện tới khi ui xong).
 * Q3.1 trang chủ: nhiệm vụ + feed + cheer · Q3.3 theo dõi, nhắn tin, trao đổi, post_ban · Q3.4 đấu 1v1.
 */
test.afterAll(async () => {
  await closeE2eDb();
});

const userId = async (handle: string) => (await e2eDb().user.findUniqueOrThrow({ where: { handle }, select: { id: true } })).id;
const skillId = async (slug: string) => (await e2eDb().skill.findUniqueOrThrow({ where: { slug }, select: { id: true } })).id;

test.describe("Trang chủ (Q3.1)", () => {
  test("API: nhiệm vụ hôm nay theo app_config.daily_quests, feed có bài lên cấp, cheer bật/tắt", async ({ request }) => {
    const token = await devToken(request, "minhhoang");
    const quests = await trpcQuery(request, token, "home.quests");
    skipIfNoProcedure(quests, "home.quests");
    expect(quests.status).toBe(200);
    const defs = (await e2eDb().appConfig.findUniqueOrThrow({ where: { key: "daily_quests" } })).value as { key: string }[];
    const q = quests.data as { quests: { key?: string; questKey?: string }[]; total: number };
    expect(q.quests.length).toBe(defs.length);
    expect(q.total).toBe(defs.length);

    const feed = await trpcQuery(request, token, "home.feed", { limit: 20 });
    expect(feed.status).toBe(200);
    const items = (feed.data as { items: { id?: string; postId?: string; kind?: string }[] }).items;
    expect(items.length, "Feed trống").toBeGreaterThan(0);
    const postId = items[0]!.id ?? items[0]!.postId!;

    const me = await userId("minhhoang");
    const state = async () => ({
      likeCount: (await e2eDb().post.findUniqueOrThrow({ where: { id: postId }, select: { likeCount: true } })).likeCount,
      mine: await e2eDb().reaction.count({ where: { postId, userId: me, kind: "cheer" } }),
      total: await e2eDb().reaction.count({ where: { postId } }),
    });
    const on = await trpcMutation(request, token, "post.react", { postId, kind: "cheer", on: true });
    expect(on.status, on.raw.slice(0, 200)).toBe(200);
    // Bấm hai lần không cộng hai lần; like_count (cache) = tổng cảm xúc (D62)
    await trpcMutation(request, token, "post.react", { postId, kind: "cheer", on: true });
    const mid = await state();
    expect(mid.mine).toBe(1);
    expect(mid.likeCount).toBe(mid.total);
    const off = await trpcMutation(request, token, "post.react", { postId, kind: "cheer", on: false });
    expect(off.status).toBe(200);
    const after = await state();
    expect(after.mine).toBe(0);
    expect(after.likeCount).toBe(after.total);
  });

  test("UI: /home hiện nhiệm vụ hôm nay và thả cheer", async ({ page }) => {
    await loginAs(page, "minhhoang");
    await gotoScreen(page, "/home", "Trang chủ");
    const defs = (await e2eDb().appConfig.findUniqueOrThrow({ where: { key: "daily_quests" } })).value as { title: string }[];
    const firstQuest = page.getByText(defs[0]!.title).first();
    test.skip(!(await firstQuest.isVisible().catch(() => false)), "Trang chủ (U3.1) chưa hiện nhiệm vụ — chờ ui");
    for (const d of defs) await expect(page.getByText(d.title).first()).toBeVisible();
    await expect(page.getByText(/\d+\s*\/\s*\d+/).first()).toBeVisible();
    const cheer = page.getByRole("button", { name: /cổ vũ|cheer/i }).first();
    await expect(cheer).toBeVisible();
    const pressed = await cheer.getAttribute("aria-pressed");
    await cheer.click();
    await expect(cheer).toHaveAttribute("aria-pressed", pressed === "true" ? "false" : "true");
  });
});

test.describe("Theo dõi, nhắn tin, trao đổi (Q3.3)", () => {
  test("API: theo dõi theo handle", async ({ request }) => {
    const token = await devToken(request, "lanphuong");
    const r = await trpcMutation(request, token, "social.follow", { handle: "ngoclan" });
    skipIfNoProcedure(r, "social.follow");
    expect(r.status, r.raw.slice(0, 200)).toBe(200);
    const [a, b] = [await userId("lanphuong"), await userId("ngoclan")];
    expect(await e2eDb().follow.count({ where: { followerId: a, followeeId: b } })).toBe(1);
    const self = await trpcMutation(request, token, "social.follow", { handle: "lanphuong" });
    expect(self.status, "Không được tự theo dõi mình").toBeGreaterThanOrEqual(400);
    expect(self.status).toBeLessThan(500);
  });

  test("API: nhắn tin chỉ 2 thành viên đọc được", async ({ request }) => {
    const a = await devToken(request, "lanphuong");
    const open = await trpcMutation(request, a, "message.open", { handle: "ngoclan" });
    skipIfNoProcedure(open, "message.open");
    expect(open.status, open.raw.slice(0, 200)).toBe(200);
    const { threadId } = open.data as { threadId: string };
    const body = `Chào bạn, tập tung hứng cùng nhé ${Date.now()}`;
    const sent = await trpcMutation(request, a, "message.send", { threadId, body });
    expect(sent.status, sent.raw.slice(0, 200)).toBe(200);

    const b = await devToken(request, "ngoclan");
    const listB = await trpcQuery(request, b, "message.list", { threadId });
    expect(listB.status).toBe(200);
    expect(listB.raw).toContain(body);

    const outsider = await devToken(request, "quocbao");
    const listX = await trpcQuery(request, outsider, "message.list", { threadId });
    expect([403, 404], `Người ngoài đọc thread: ${listX.status}`).toContain(listX.status);
    expect(listX.raw).not.toContain(body);
    const sendX = await trpcMutation(request, outsider, "message.send", { threadId, body: "chen ngang" });
    expect([403, 404]).toContain(sendX.status);
  });

  test("API: đề nghị trao đổi kỹ năng → người nhận chấp nhận", async ({ request }) => {
    const a = await devToken(request, "lanphuong");
    const r = await trpcMutation(request, a, "swap.propose", {
      receiverHandle: "ngoclan",
      teachSkillId: await skillId("dan-len"),
      learnSkillId: await skillId("so-cuu"),
      mode: "video",
    });
    skipIfNoProcedure(r, "swap.propose");
    expect(r.status, r.raw.slice(0, 200)).toBe(200);
    const swap = await e2eDb().skillSwap.findFirstOrThrow({
      where: { proposerId: await userId("lanphuong"), receiverId: await userId("ngoclan") },
      orderBy: { createdAt: "desc" },
    });
    expect(swap.status).toBe("proposed");

    // Người đề nghị không tự chấp nhận được
    const selfAccept = await trpcMutation(request, a, "swap.respond", { swapId: swap.id, action: "accept" });
    expect(selfAccept.status).toBeGreaterThanOrEqual(400);

    const b = await devToken(request, "ngoclan");
    const acc = await trpcMutation(request, b, "swap.respond", { swapId: swap.id, action: "accept" });
    expect(acc.status, acc.raw.slice(0, 200)).toBe(200);
    expect((await e2eDb().skillSwap.findUniqueOrThrow({ where: { id: swap.id } })).status).toBe("accepted");
  });

  test("API: người bị post_ban không đăng bài được", async ({ request }) => {
    const editor = await devToken(request, "bientap");
    const ban = await trpcMutation(request, editor, "admin.sanction", {
      userId: await userId("hoangnam"),
      kind: "post_ban",
      reason: "Spam (e2e)",
      durationDays: 1,
    });
    skipIfNoProcedure(ban, "admin.sanction");
    expect(ban.status, ban.raw.slice(0, 200)).toBe(200);
    const t = await devToken(request, "hoangnam");
    const post = await trpcMutation(request, t, "post.create", { body: "Bài thử khi bị cấm" });
    expect(post.status).toBe(403);
    // Người thường không xử phạt được
    const m = await devToken(request, "minhhoang");
    const notEditor = await trpcMutation(request, m, "admin.sanction", { userId: await userId("ngoclan"), kind: "warning", reason: "x" });
    expect(notEditor.status).toBe(403);
  });

  test("UI: hồ sơ người khác có Theo dõi / Nhắn tin, URL theo handle", async ({ page }) => {
    await loginAs(page, "lanphuong");
    await gotoScreen(page, "/u/thuha", "Hồ sơ người khác");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Thu Hà/);
    await expect(page.getByRole("button", { name: /^(Theo dõi|Đang theo dõi)$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nhắn tin/ }).or(page.getByRole("link", { name: /Nhắn tin/ })).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/@demo\.skillverse\.local/);
    // Lưu ý gặp mặt chỉ hiện sau khi đề nghị được chấp nhận (SKILL.md)
    await expect(page.getByText(/gặp mặt.*nơi công cộng|nơi công cộng/i)).toHaveCount(0);
  });
});

test.describe("Đấu 1v1 (Q3.4)", () => {
  test("API: 1 phiếu/người, người tham gia không tự bầu, video là URL ký", async ({ request }) => {
    const voter = await devToken(request, "minhhoang");
    const list = await trpcQuery(request, voter, "duel.list");
    skipIfNoProcedure(list, "duel.list");
    expect(list.status).toBe(200);
    const duel = await e2eDb().duel.findFirstOrThrow({ where: { winnerId: null }, orderBy: { createdAt: "asc" } });
    test.skip(duel.voteEndsAt.getTime() < Date.now(), "Đấu seed đã hết hạn bỏ phiếu");

    const got = await trpcQuery(request, voter, "duel.get", { duelId: duel.id });
    expect(got.status).toBe(200);
    expect(got.raw, "duel.get lộ khóa object").not.toMatch(/"mediaKey"|seed\/duel-[a-z]+\.mp4"/);
    const urls = got.raw.match(/https?:\/\/[^"]+/g) ?? [];
    for (const u of urls.filter((x) => /duel-/.test(x))) expect(u).toMatch(/X-Amz-Expires=/);

    const v1 = await trpcMutation(request, voter, "duel.vote", { duelId: duel.id, choice: duel.userA });
    expect(v1.status, v1.raw.slice(0, 200)).toBe(200);
    const v2 = await trpcMutation(request, voter, "duel.vote", { duelId: duel.id, choice: duel.userB });
    expect(v2.status, "Phiếu thứ hai phải bị chặn").toBeGreaterThanOrEqual(400);
    expect(v2.status).toBeLessThan(500);
    expect(await e2eDb().duelVote.count({ where: { duelId: duel.id, userId: await userId("minhhoang") } })).toBe(1);

    const participantHandle = (await e2eDb().user.findUniqueOrThrow({ where: { id: duel.userA }, select: { handle: true } })).handle;
    const p = await devToken(request, participantHandle);
    const selfVote = await trpcMutation(request, p, "duel.vote", { duelId: duel.id, choice: duel.userA });
    expect(selfVote.status, "Người tham gia không được tự bầu").toBeGreaterThanOrEqual(400);

    const bad = await trpcMutation(request, await devToken(request, "ducanh"), "duel.vote", { duelId: duel.id, choice: await userId("ducanh") });
    expect(bad.status, "Lựa chọn không thuộc trận phải bị chặn").toBeGreaterThanOrEqual(400);
  });

  test("UI: tab Đấu 1v1 bỏ phiếu", async ({ page }) => {
    await loginAs(page, "ducanh");
    await gotoScreen(page, "/challenges", "Thử thách");
    const tab = page.getByRole("tab", { name: /Đấu 1v1/ });
    test.skip((await tab.count()) === 0, "Thử thách (U3.2) chưa có tab Đấu 1v1 — chờ ui");
    await tab.click();
    const vote = page.getByRole("button", { name: /^Bầu / }).first();
    await expect(vote).toBeVisible();
    await vote.click();
    await expect(page.getByText(/Bạn đã bầu/).first()).toBeVisible();
    // 1 phiếu/người: hết nút bầu sau khi đã bầu
    await expect(page.getByRole("button", { name: /^Bầu / })).toHaveCount(0);
  });
});
