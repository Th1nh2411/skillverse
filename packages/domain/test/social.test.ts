import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDuels,
  commentOnPost,
  createDuel,
  follow,
  getActiveChallenges,
  getDailyQuests,
  getDuel,
  getHomeFeed,
  getOrCreateThread,
  getPendingProofsForCommunity,
  joinChallenge,
  listComments,
  listDuels,
  listMessages,
  listNotifications,
  listSwaps,
  listThreads,
  markNotificationsRead,
  progressQuest,
  proposeSwap,
  rateSwap,
  reactToPost,
  respondSwap,
  sanctionUser,
  sendMessage,
  unfollow,
  voteDuel,
} from "../src";
import { closeTestDb, fx, getTestDb, resetDb, setConfig, type FxSkill } from "../src/testing";
import { NOW, proofThroughLoop } from "./helpers";

const db = getTestDb();
const DAY = 86_400_000;
let catId: string;
let skill: FxSkill;
let editor: { id: string };

beforeAll(async () => {
  await resetDb(db);
  catId = (await fx.category(db)).id;
  skill = await fx.skill(db, { categoryId: catId, name: "Tung hứng" });
  editor = await fx.user(db, { isEditor: true });
});

afterAll(async () => {
  await closeTestDb();
});

describe("nhiệm vụ ngày + chuỗi ngày", () => {
  it("tạo dòng còn thiếu, cộng tiến độ, XP quest_done một lần, streak liên tiếp", async () => {
    const u = await fx.user(db);
    const q0 = await getDailyQuests(db, { userId: u.id, now: NOW });
    expect(q0.quests.map((q) => [q.key, q.progress, q.done])).toEqual([
      ["practice_10min", 0, false],
      ["review_2", 0, false],
      ["suggest_criteria", 0, false],
    ]);
    expect(await db.dailyQuest.count({ where: { userId: u.id } })).toBe(3);
    expect(q0.streak).toBe(0);

    const r = await progressQuest(db, { userId: u.id, questKey: "practice_10min", now: NOW });
    expect(r).toEqual({ progress: 1, target: 1, completed: true, xpAwarded: 20 });
    const again = await progressQuest(db, { userId: u.id, questKey: "practice_10min", now: NOW });
    expect(again.xpAwarded).toBe(0);
    expect(await db.xpLedger.count({ where: { userId: u.id, reason: "quest_done" } })).toBe(1);
    await expect(progressQuest(db, { userId: u.id, questKey: "khong-co" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Hôm qua và hôm kia cũng hoàn thành → streak 3; hôm nay chưa làm gì thì vẫn tính tới hôm qua
    for (const d of [1, 2]) await progressQuest(db, { userId: u.id, questKey: "practice_10min", now: new Date(NOW.getTime() - d * DAY) });
    const q1 = await getDailyQuests(db, { userId: u.id, now: NOW });
    expect(q1).toMatchObject({ streak: 3, activeToday: true, completedCount: 1, total: 3 });
    const tomorrow = await getDailyQuests(db, { userId: u.id, now: new Date(NOW.getTime() + DAY) });
    expect(tomorrow).toMatchObject({ streak: 3, activeToday: false, completedCount: 0 });
    const gap = await getDailyQuests(db, { userId: u.id, now: new Date(NOW.getTime() + 2 * DAY) });
    expect(gap.streak).toBe(0);
  });

  it("hai lần cộng đồng thời chỉ thưởng XP một lần", async () => {
    const u = await fx.user(db);
    await Promise.all([1, 2, 3].map(() => progressQuest(db, { userId: u.id, questKey: "practice_10min", now: NOW })));
    expect(await db.xpLedger.count({ where: { userId: u.id, reason: "quest_done" } })).toBe(1);
  });
});

describe("feed", () => {
  it("bài theo dõi trước (mới nhất), rồi phổ biến; phân trang; cảm xúc + bình luận cập nhật đếm", async () => {
    const me = await fx.user(db);
    const friend = await fx.user(db);
    const stranger = await fx.user(db);
    const banned = await fx.user(db, { status: "banned" });
    await follow(db, { followerId: me.id, followeeId: friend.id });
    await db.skillFollow.create({ data: { userId: me.id, skillId: skill.id } });
    const t = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
    const fOld = await fx.post(db, { authorId: friend.id, skillId: (await fx.skill(db, { categoryId: catId })).id, createdAt: t(5) });
    const fNew = await fx.post(db, { authorId: friend.id, skillId: (await fx.skill(db, { categoryId: catId })).id, createdAt: t(1) });
    const bySkill = await fx.post(db, { authorId: stranger.id, skillId: skill.id, createdAt: t(3) });
    const otherSkill = await fx.skill(db, { categoryId: catId });
    const pop = await fx.post(db, { authorId: stranger.id, skillId: otherSkill.id, createdAt: t(10) });
    await db.post.update({ where: { id: pop.id }, data: { likeCount: 50 } });
    const noSkill = await db.post.create({ data: { authorId: stranger.id, kind: "text", body: "không kỹ năng", createdAt: t(9) } });
    await fx.post(db, { authorId: banned.id, skillId: otherSkill.id, createdAt: t(0.5) });

    const p1 = await getHomeFeed(db, { userId: me.id, limit: 2 });
    expect(p1.items.map((i) => i.id)).toEqual([fNew.id, bySkill.id]);
    const p2 = await getHomeFeed(db, { userId: me.id, limit: 2, cursor: p1.nextCursor });
    expect(p2.items.map((i) => [i.id, i.followed])).toEqual([
      [fOld.id, true],
      [pop.id, false],
    ]);
    const p3 = await getHomeFeed(db, { userId: me.id, limit: 2, cursor: p2.nextCursor });
    expect(p3.items.map((i) => i.id)).toContain(noSkill.id);
    const all = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(new Set(all).size).toBe(all.length);
    await expect(getHomeFeed(db, { userId: me.id, cursor: "rac" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const r1 = await reactToPost(db, { postId: fNew.id, userId: me.id, kind: "cheer", on: true });
    const r2 = await reactToPost(db, { postId: fNew.id, userId: me.id, kind: "cheer", on: true });
    expect(r2).toEqual({ likeCount: 1, myReactions: ["cheer"] });
    expect(r1.likeCount).toBe(1);
    await reactToPost(db, { postId: fNew.id, userId: stranger.id, kind: "like", on: true });
    expect((await reactToPost(db, { postId: fNew.id, userId: me.id, kind: "cheer", on: false })).likeCount).toBe(1);
    expect(await db.notification.count({ where: { userId: friend.id, kind: "post_reaction" } })).toBe(2);

    const c = await commentOnPost(db, { postId: fNew.id, userId: me.id, body: "  Hay quá  " });
    expect(c.commentCount).toBe(1);
    const cs = await listComments(db, { postId: fNew.id });
    expect(cs.items).toEqual([expect.objectContaining({ body: "Hay quá" })]);
    await expect(commentOnPost(db, { postId: fNew.id, userId: me.id, body: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("bài lên cấp có số người duyệt đạt / tổng phiếu", async () => {
    const { submitter, proofId } = await proofThroughLoop(db, { categoryId: catId });
    const feed = await getHomeFeed(db, { userId: submitter.id });
    expect(feed.items[0]).toMatchObject({ kind: "level_up", levelUp: { proofId, level: 1, passVotes: 3, totalVotes: 3 } });
    // Huy hiệu trên bài lên cấp: danh mục + độ hiếm
    expect(feed.items[0]!.skill).toMatchObject({ category: { slug: expect.any(String) } });
    expect(feed.items[0]!.skill).toHaveProperty("rarity");
  });
});

describe("thử thách + chờ duyệt cộng đồng", () => {
  it("tham gia bằng bằng chứng của mình, đúng kỹ năng, trong thời gian", async () => {
    const u = await fx.user(db);
    const ch = await db.challenge.create({
      data: {
        title: "Nhóm lửa trong mưa",
        skillId: skill.id,
        criteria: { description: "Giữ lửa 3 phút", items: ["Lửa cháy 3 phút"] },
        startsAt: new Date(NOW.getTime() - 2 * DAY),
        endsAt: new Date(NOW.getTime() + 3 * DAY),
        xpReward: 600,
      },
    });
    await db.challenge.create({
      data: { title: "Đã hết", skillId: skill.id, criteria: {}, startsAt: new Date(NOW.getTime() - 9 * DAY), endsAt: new Date(NOW.getTime() - DAY) },
    });
    const proof = await fx.proof(db, { userId: u.id, skill, targetLevel: 1, createdAt: NOW });
    const other = await fx.proof(db, { userId: (await fx.user(db)).id, skill, targetLevel: 1, createdAt: NOW });
    await expect(joinChallenge(db, { challengeId: ch.id, userId: u.id, proofId: other.id, now: NOW })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await joinChallenge(db, { challengeId: ch.id, userId: u.id, proofId: proof.id, now: NOW });
    await expect(joinChallenge(db, { challengeId: ch.id, userId: u.id, proofId: proof.id, now: NOW })).rejects.toMatchObject({ code: "CONFLICT" });
    const list = await getActiveChallenges(db, { userId: u.id, now: NOW });
    expect(list.map((c) => c.title)).toEqual(["Nhóm lửa trong mưa"]);
    expect(list[0]).toMatchObject({ participantCount: 1, joined: true, description: "Giữ lửa 3 phút", items: ["Lửa cháy 3 phút"], xpReward: 600 });
  });

  it("bằng chứng chờ duyệt ẩn danh; người được phân công thấy assignmentId", async () => {
    const { submitter, proofId, assignments } = await proofThroughLoop(db, { categoryId: catId, verdicts: ["pass"] });
    const viewer = assignments[1]!.reviewerId;
    const r = await getPendingProofsForCommunity(db, { viewerId: viewer, now: NOW });
    const item = r.items.find((i) => i.myAssignmentId === assignments[1]!.id)!;
    expect(item).toMatchObject({ votes: 1, required: 3, isMine: false });
    const json = JSON.stringify(r);
    expect(json).not.toContain(submitter.id);
    expect(json).not.toContain(submitter.handle);
    expect(json).not.toContain(proofId);
  });
});

describe("đấu 1v1", () => {
  it("1 phiếu/người, người đấu không bầu, hết hạn khóa; closeDuels trao XP challenge_won", async () => {
    await setConfig(db, "xp_rewards", { review_done: 25, proposal_accepted: 150, quest_min: 20, quest_max: 50, duel_won: 200 });
    const a = await fx.user(db);
    const b = await fx.user(db);
    const voters = await Promise.all([1, 2, 3].map(() => fx.user(db)));
    const ends = new Date(NOW.getTime() + 3_600_000);
    await expect(
      createDuel(db, { creatorId: voters[0]!.id, skillId: skill.id, metric: "Giây", userA: a.id, userB: b.id, voteEndsAt: ends, now: NOW }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { duelId } = await createDuel(db, { creatorId: a.id, skillId: skill.id, metric: "Bowline (giây)", userA: a.id, userB: b.id, voteEndsAt: ends, now: NOW });
    expect(await db.notification.count({ where: { userId: b.id, kind: "duel_created" } })).toBe(1);

    await expect(voteDuel(db, { duelId, userId: a.id, choice: a.id, now: NOW })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await voteDuel(db, { duelId, userId: voters[0]!.id, choice: a.id, now: NOW });
    await expect(voteDuel(db, { duelId, userId: voters[0]!.id, choice: b.id, now: NOW })).rejects.toMatchObject({ code: "CONFLICT" });
    const v = await voteDuel(db, { duelId, userId: voters[1]!.id, choice: a.id, now: NOW });
    expect(v).toEqual({ votesA: 2, votesB: 0 });
    await expect(voteDuel(db, { duelId, userId: voters[2]!.id, choice: b.id, now: ends })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const view = await getDuel(db, { duelId, viewerId: voters[2]!.id, now: NOW });
    expect(view).toMatchObject({ canVote: true, closed: false, myVote: null });
    expect(view.sides.map((s) => s.votes)).toEqual([2, 0]);
    expect((await getDuel(db, { duelId, viewerId: voters[0]!.id, now: NOW })).canVote).toBe(false);
    expect((await listDuels(db, { now: NOW })).map((d) => d.id)).toContain(duelId);

    const res = await closeDuels(db, { now: ends });
    expect(res.winners).toBeGreaterThanOrEqual(1);
    expect((await db.duel.findUniqueOrThrow({ where: { id: duelId } })).winnerId).toBe(a.id);
    expect(await db.xpLedger.findFirst({ where: { userId: a.id, reason: "challenge_won" } })).toMatchObject({ amount: 200, refId: duelId });
    await closeDuels(db, { now: ends });
    expect(await db.xpLedger.count({ where: { userId: a.id, reason: "challenge_won" } })).toBe(1);
  });

  it("hòa → không ai thắng, thông báo một lần", async () => {
    const a = await fx.user(db);
    const b = await fx.user(db);
    const ends = new Date(NOW.getTime() + 3_600_000);
    const { duelId } = await createDuel(db, { creatorId: editor.id, skillId: skill.id, metric: "x", userA: a.id, userB: b.id, voteEndsAt: ends, now: NOW });
    await closeDuels(db, { now: ends });
    await closeDuels(db, { now: ends });
    expect((await db.duel.findUniqueOrThrow({ where: { id: duelId } })).winnerId).toBeNull();
    expect(await db.notification.count({ where: { refId: duelId, kind: "duel_tied" } })).toBe(2);
  });
});

describe("theo dõi, trao đổi, nhắn tin, thông báo", () => {
  it("follow idempotent + thông báo; unfollow", async () => {
    const a = await fx.user(db);
    const b = await fx.user(db);
    await follow(db, { followerId: a.id, followeeId: b.id });
    expect((await follow(db, { followerId: a.id, followeeId: b.id })).followerCount).toBe(1);
    expect(await db.notification.count({ where: { userId: b.id, kind: "new_follower" } })).toBe(1);
    await expect(follow(db, { followerId: a.id, followeeId: a.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await unfollow(db, { followerId: a.id, followeeId: b.id })).followerCount).toBe(0);
  });

  it("đề nghị → chấp nhận → hoàn thành → đánh giá; ràng buộc kỹ năng và trạng thái", async () => {
    const teachSkill = await fx.skill(db, { categoryId: catId, name: "Lửa" });
    const a = await fx.user(db);
    const b = await fx.user(db);
    await expect(
      proposeSwap(db, { proposerId: a.id, receiverId: b.id, teachSkillId: teachSkill.id, learnSkillId: skill.id, mode: "video" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await fx.setUserSkillLevel(db, a.id, teachSkill.id, 2);
    await fx.setUserSkillLevel(db, b.id, skill.id, 3);
    const { swapId } = await proposeSwap(db, { proposerId: a.id, receiverId: b.id, teachSkillId: teachSkill.id, learnSkillId: skill.id, mode: "in_person" });
    await expect(
      proposeSwap(db, { proposerId: a.id, receiverId: b.id, teachSkillId: teachSkill.id, learnSkillId: skill.id, mode: "video" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(respondSwap(db, { swapId, userId: a.id, action: "accept" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(rateSwap(db, { swapId, raterId: a.id, stars: 5 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const when = new Date(NOW.getTime() + 2 * DAY);
    expect(await respondSwap(db, { swapId, userId: b.id, action: "accept", scheduledAt: when })).toMatchObject({ status: "accepted" });
    expect(await respondSwap(db, { swapId, userId: a.id, action: "complete" })).toMatchObject({ status: "done" });
    await rateSwap(db, { swapId, raterId: a.id, stars: 5, comment: "Dạy dễ hiểu" });
    await expect(rateSwap(db, { swapId, raterId: a.id, stars: 4 })).rejects.toMatchObject({ code: "CONFLICT" });
    const list = await listSwaps(db, { userId: b.id });
    expect(list[0]).toMatchObject({ role: "receiver", status: "done", canRate: true, scheduledAt: when });
    expect((await listSwaps(db, { userId: a.id }))[0]).toMatchObject({ canRate: false, myRating: 5 });
  });

  it("nhắn tin: một thread mỗi cặp, chỉ thành viên, người bị suspension không gửi được", async () => {
    const a = await fx.user(db);
    const b = await fx.user(db);
    const outsider = await fx.user(db);
    const [t1, t2] = await Promise.all([
      getOrCreateThread(db, { userId: a.id, otherUserId: b.id }),
      getOrCreateThread(db, { userId: b.id, otherUserId: a.id }),
    ]);
    expect(t1.threadId).toBe(t2.threadId);
    await sendMessage(db, { threadId: t1.threadId, senderId: a.id, body: "Chào bạn", now: NOW });
    await sendMessage(db, { threadId: t1.threadId, senderId: b.id, body: "Chào", now: new Date(NOW.getTime() + 1000) });
    await expect(sendMessage(db, { threadId: t1.threadId, senderId: outsider.id, body: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listMessages(db, { threadId: t1.threadId, userId: outsider.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const msgs = await listMessages(db, { threadId: t1.threadId, userId: a.id });
    expect(msgs.items.map((m) => [m.body, m.mine])).toEqual([
      ["Chào", false],
      ["Chào bạn", true],
    ]);
    expect(msgs.canSend).toBe(true);
    const threads = await listThreads(db, { userId: a.id });
    expect(threads[0]).toMatchObject({ lastMessage: { body: "Chào", mine: false }, unread: 1, other: { handle: b.handle } });

    await sanctionUser(db, { editorId: editor.id, userId: a.id, kind: "suspension", reason: "Quấy rối", durationDays: 7 });
    await expect(sendMessage(db, { threadId: t1.threadId, senderId: a.id, body: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listMessages(db, { threadId: t1.threadId, userId: a.id })).canSend).toBe(false);

    const n = await listNotifications(db, { userId: b.id });
    expect(n.items.some((i) => i.kind === "message")).toBe(true);
    expect(n.unreadCount).toBeGreaterThan(0);
    await markNotificationsRead(db, { userId: b.id });
    expect((await listNotifications(db, { userId: b.id })).unreadCount).toBe(0);
  });
});
