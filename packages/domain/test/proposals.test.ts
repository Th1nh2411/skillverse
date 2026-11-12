import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeCriteriaProposal,
  closeExpiredProposals,
  commentOnProposal,
  decideNewSkill,
  getProposal,
  getSkillDetail,
  listProposalComments,
  listProposals,
  proposeCriteriaEdit,
  proposeNewSkill,
  supportProposal,
  voteCriteriaEdit,
} from "../src";
import { closeTestDb, fx, getTestDb, resetDb, setConfig, type FxSkill } from "../src/testing";
import { NOW } from "./helpers";

const db = getTestDb();
const DAY = 86_400_000;
const LATER = new Date(NOW.getTime() + 15 * DAY);
let cat: { id: string; slug: string };
let editor: { id: string };

beforeAll(async () => {
  await resetDb(db);
  cat = await fx.category(db, { slug: "ky-nang-di", name: "Kỹ năng dị" });
  editor = await fx.user(db, { isEditor: true });
  await db.badge.create({ data: { slug: "proposal-accepted", name: "Người góp ý" } });
  await setConfig(db, "new_skill_defaults", { xp_per_level: 100, min_reviewers: 3, reviewer_level_offset: 1 });
  await setConfig(db, "new_skill_support_needed", { supporters: 3, days: 14 });
});

afterAll(async () => {
  await setConfig(db, "new_skill_support_needed", { supporters: 50, days: 14 });
  await closeTestDb();
});

/** n người dùng đạt `level` ở kỹ năng (tạo hàng loạt). */
async function usersAtLevel(skillId: string, n: number, level: number) {
  const tag = randomBytes(3).toString("hex");
  const data = Array.from({ length: n }, (_, i) => ({
    handle: `v${tag}_${level}_${i}`,
    displayName: `Người bỏ phiếu ${i}`,
    email: `v${tag}_${level}_${i}@test.skillverse.local`,
  }));
  await db.user.createMany({ data });
  const users = await db.user.findMany({ where: { handle: { in: data.map((d) => d.handle) } }, select: { id: true } });
  await db.userSkill.createMany({ data: users.map((u) => ({ userId: u.id, skillId, level })) });
  return users.map((u) => u.id);
}

const levels = [
  ["Tiếng đầu tiên", "Tạo được tiếng kêu", "Kẹp lá giữa hai ngón cái, thổi nhẹ."],
  ["Nốt dài", "Giữ một nốt 5 giây", ""],
  ["Giai điệu", "Thổi một giai điệu", "Chọn bài quen thuộc, ngắn."],
].map(([title, text, description]) => ({ title: title!, description, criteria: [{ text: text! }] }));

describe("đề xuất kỹ năng mới", () => {
  it("ủng hộ đủ → editor_review → biên tập viên mở kỹ năng (v1), XP + huy hiệu tác giả", async () => {
    const author = await fx.user(db);
    const { proposalId, votingEndsAt } = await proposeNewSkill(db, {
      authorId: author.id,
      name: "Huýt sáo bằng lá",
      categorySlug: cat.slug,
      description: "Tạo âm thanh bằng một chiếc lá",
      riskLevel: "none",
      levels,
      now: NOW,
    });
    expect(votingEndsAt.getTime()).toBe(NOW.getTime() + 14 * DAY);
    // Trùng tên (không phân biệt hoa thường / dấu) với đề xuất đang mở
    await expect(
      proposeNewSkill(db, { authorId: (await fx.user(db)).id, name: "HUÝT SÁO BẰNG LÁ", categorySlug: cat.slug, riskLevel: "none", levels }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      proposeNewSkill(db, { authorId: author.id, name: "Khác", categorySlug: "khong-co", riskLevel: "none", levels }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(supportProposal(db, { proposalId, userId: author.id, now: NOW })).rejects.toMatchObject({ code: "CONFLICT" });
    const s1 = await supportProposal(db, { proposalId, userId: (await fx.user(db)).id, now: NOW });
    expect(s1).toEqual({ supportCount: 2, needed: 3, status: "gathering" });
    await expect(decideNewSkill(db, { proposalId, editorId: editor.id, decision: "accepted", now: NOW })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    const s2 = await supportProposal(db, { proposalId, userId: (await fx.user(db)).id, now: NOW });
    expect(s2.status).toBe("editor_review");
    expect(await db.notification.count({ where: { userId: editor.id, kind: "proposal_editor_review", refId: proposalId } })).toBe(1);
    await expect(supportProposal(db, { proposalId, userId: (await fx.user(db)).id, now: NOW })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });

    await expect(decideNewSkill(db, { proposalId, editorId: author.id, decision: "accepted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const d = await decideNewSkill(db, { proposalId, editorId: editor.id, decision: "accepted", now: NOW });
    expect(d).toMatchObject({ status: "accepted", skillSlug: "huyt-sao-bang-la" });
    const skill = await db.skill.findUniqueOrThrow({
      where: { id: d.skillId! },
      include: { skillLevels: { orderBy: { level: "asc" }, include: { currentVersion: { include: { criteria: true } } } } },
    });
    expect(skill).toMatchObject({ status: "active", maxLevel: 3, createdBy: author.id, riskLevel: "none" });
    expect(skill.skillLevels.map((l) => [l.level, l.xpReward, l.minReviewers, l.minReviewerLevel, l.currentVersion?.version])).toEqual([
      [1, 100, 3, 1, 1],
      [2, 200, 3, 1, 1],
      [3, 300, 3, 2, 1],
    ]);
    expect(skill.skillLevels[2]?.currentVersion?.criteria.map((c) => c.text)).toEqual(["Thổi một giai điệu"]);
    // Mốc: tên + hướng dẫn được ghi vào skill_levels (hướng dẫn rỗng → null)
    expect(skill.skillLevels.map((l) => [l.title, l.description])).toEqual([
      ["Tiếng đầu tiên", "Kẹp lá giữa hai ngón cái, thổi nhẹ."],
      ["Nốt dài", null],
      ["Giai điệu", "Chọn bài quen thuộc, ngắn."],
    ]);
    expect(await db.xpLedger.findFirst({ where: { userId: author.id, reason: "proposal_accepted" } })).toMatchObject({ amount: 150 });
    expect(await db.userBadge.count({ where: { userId: author.id, badge: { slug: "proposal-accepted" } } })).toBe(1);
    const detail = await getProposal(db, { proposalId });
    expect(detail.createdSkillSlug).toBe("huyt-sao-bang-la");
    const asAuthor = await getProposal(db, { proposalId, viewerId: author.id });
    expect(asAuthor).toMatchObject({ mySupport: true, supportRule: { supporters: 3, days: 14 }, supportNeeded: 3 });
    expect((await getProposal(db, { proposalId, viewerId: editor.id })).mySupport).toBe(false);
    const listed = await listProposals(db, { kind: "new_skill", viewerId: author.id });
    expect(listed.items.find((i) => i.id === proposalId)).toMatchObject({ mySupport: true, supportRule: { supporters: 3, days: 14 } });
  });

  it("kỹ năng rủi ro cao cũng phải qua biên tập; từ chối; hết hạn chưa đủ ủng hộ → expired", async () => {
    const author = await fx.user(db);
    const high = await proposeNewSkill(db, { authorId: author.id, name: "Thổi lửa", categorySlug: cat.slug, riskLevel: "high", levels, now: NOW });
    await expect(decideNewSkill(db, { proposalId: high.proposalId, editorId: editor.id, decision: "accepted" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    for (let i = 0; i < 2; i++) await supportProposal(db, { proposalId: high.proposalId, userId: (await fx.user(db)).id, now: NOW });
    const r = await decideNewSkill(db, { proposalId: high.proposalId, editorId: editor.id, decision: "rejected", now: NOW });
    expect(r).toMatchObject({ status: "rejected", skillId: null });

    const stale = await proposeNewSkill(db, { authorId: author.id, name: "Đề xuất nguội", categorySlug: cat.slug, riskLevel: "none", levels, now: NOW });
    const res = await closeExpiredProposals(db, { now: LATER });
    expect(res.newSkillExpired).toBeGreaterThanOrEqual(1);
    expect((await db.proposal.findUniqueOrThrow({ where: { id: stale.proposalId } })).status).toBe("expired");
    expect((await closeExpiredProposals(db, { now: LATER })).newSkillExpired).toBe(0);
    await expect(supportProposal(db, { proposalId: stale.proposalId, userId: (await fx.user(db)).id, now: LATER })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});

describe("sửa tiêu chí có trọng số", () => {
  let skill: FxSkill;
  let levelId: string;

  beforeAll(async () => {
    skill = await fx.skill(db, { categoryId: cat.id, criteria: (lv) => [`Gốc cấp ${lv}`] });
    levelId = skill.levels.get(4)!.levelId;
  });

  async function newEdit(summary: string) {
    const author = await fx.user(db);
    const r = await proposeCriteriaEdit(db, {
      authorId: author.id,
      skillLevelId: levelId,
      summary,
      criteria: [{ text: "Gỗ tự kiếm tại chỗ" }, { text: "Lửa thành ngọn dưới 5 phút" }],
      now: NOW,
    });
    return { author, proposalId: r.proposalId };
  }

  async function castVotes(proposalId: string, agree: number, disagree: number, zeroWeightAgree = 0) {
    const a = await usersAtLevel(skill.id, agree, 5);
    const d = await usersAtLevel(skill.id, disagree, 5);
    const z = await usersAtLevel(skill.id, zeroWeightAgree, 4);
    for (const u of a) await voteCriteriaEdit(db, { proposalId, userId: u, vote: "agree", now: NOW });
    for (const u of d) await voteCriteriaEdit(db, { proposalId, userId: u, vote: "disagree", now: NOW });
    for (const u of z) await voteCriteriaEdit(db, { proposalId, userId: u, vote: "agree", now: NOW });
  }

  it("đúng 70% với 30 phiếu có trọng số → thông qua: version mới, trỏ current_version_id, không sửa criteria cũ", async () => {
    const { author, proposalId } = await newEdit("Cấp 4: gỗ tự kiếm");
    const oldVersionId = skill.levels.get(4)!.versionId;
    const oldCriteria = await db.criterion.findMany({ where: { criteriaVersionId: oldVersionId } });
    await castVotes(proposalId, 21, 9);
    await expect(closeCriteriaProposal(db, { proposalId, now: NOW })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const r = await closeCriteriaProposal(db, { proposalId, now: LATER });
    expect(r).toMatchObject({ status: "accepted", version: 2, tally: { weightedVoteCount: 30, agreeWeight: 21, totalWeight: 30 } });
    const sl = await db.skillLevel.findUniqueOrThrow({ where: { id: levelId } });
    expect(sl.currentVersionId).toBe(r.status === "accepted" ? r.criteriaVersionId : null);
    const v2 = await db.criteriaVersion.findUniqueOrThrow({ where: { id: sl.currentVersionId! }, include: { criteria: { orderBy: { position: "asc" } } } });
    expect(v2).toMatchObject({ version: 2, sourceProposalId: proposalId });
    expect(v2.criteria.map((c) => c.text)).toEqual(["Gỗ tự kiếm tại chỗ", "Lửa thành ngọn dưới 5 phút"]);
    expect(await db.criterion.findMany({ where: { criteriaVersionId: oldVersionId } })).toEqual(oldCriteria);
    expect(await db.xpLedger.count({ where: { userId: author.id, reason: "proposal_accepted", refId: proposalId } })).toBe(1);
    const d = await getSkillDetail(db, { slug: skill.slug });
    expect(d.levels[3]?.criteriaVersion).toBe(2);
    await expect(closeCriteriaProposal(db, { proposalId, now: LATER })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("hòa phiếu → rejected", async () => {
    const { proposalId } = await newEdit("Hòa phiếu");
    await castVotes(proposalId, 15, 15);
    expect(await closeCriteriaProposal(db, { proposalId, now: LATER })).toMatchObject({ status: "rejected" });
  });

  it("dưới 70% (20/30) → rejected", async () => {
    const { proposalId } = await newEdit("Dưới ngưỡng");
    await castVotes(proposalId, 20, 10);
    expect(await closeCriteriaProposal(db, { proposalId, now: LATER })).toMatchObject({ status: "rejected" });
  });

  it("dưới 30 phiếu có trọng số (29 đồng ý + 10 phiếu weight 0) → expired; phiếu weight 0 không tính", async () => {
    const { proposalId } = await newEdit("Ít phiếu");
    await castVotes(proposalId, 29, 0, 10);
    const zero = await db.proposalVote.count({ where: { proposalId, weight: 0 } });
    expect(zero).toBe(10);
    const r = await closeCriteriaProposal(db, { proposalId, now: LATER });
    expect(r).toMatchObject({ status: "expired", tally: { voteCount: 39, weightedVoteCount: 29, totalWeight: 29 } });
  });

  it("phiếu weight 0 không kéo tỉ lệ: 21/9 có trọng số + 20 phiếu phản đối weight 0 → thông qua (qua cron)", async () => {
    const { proposalId } = await newEdit("Có phiếu không trọng số");
    await castVotes(proposalId, 21, 9);
    for (const u of await usersAtLevel(skill.id, 20, 1)) await voteCriteriaEdit(db, { proposalId, userId: u, vote: "disagree", now: NOW });
    const res = await closeExpiredProposals(db, { now: LATER });
    expect(res.criteriaAccepted).toBeGreaterThanOrEqual(1);
    expect((await db.proposal.findUniqueOrThrow({ where: { id: proposalId } })).status).toBe("accepted");
    // version tiếp theo của cùng cấp
    expect((await db.criteriaVersion.findFirst({ where: { sourceProposalId: proposalId } }))?.version).toBe(3);
  });

  it("đổi phiếu trước hạn, không bỏ phiếu sau hạn; nhiệm vụ suggest_criteria tiến khi đề xuất/bỏ phiếu/bình luận", async () => {
    const { author, proposalId } = await newEdit("Đổi phiếu");
    expect((await db.dailyQuest.findFirst({ where: { userId: author.id, questKey: "suggest_criteria" } }))?.doneAt).not.toBeNull();
    const [voter] = await usersAtLevel(skill.id, 1, 5);
    const a = await voteCriteriaEdit(db, { proposalId, userId: voter!, vote: "agree", now: NOW });
    expect(a).toMatchObject({ myWeight: 1, agreeWeight: 1, totalWeight: 1 });
    const b = await voteCriteriaEdit(db, { proposalId, userId: voter!, vote: "disagree", now: NOW });
    expect(b).toMatchObject({ agreeWeight: 0, totalWeight: 1, voteCount: 1 });
    expect(await db.dailyQuest.findFirst({ where: { userId: voter!, questKey: "suggest_criteria" } })).toMatchObject({ progress: 1 });
    await expect(voteCriteriaEdit(db, { proposalId, userId: voter!, vote: "agree", now: LATER })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    const commenter = await fx.user(db);
    await commentOnProposal(db, { proposalId, userId: commenter.id, body: "Nên giữ tiêu chí thời gian", now: NOW });
    expect((await db.dailyQuest.findFirst({ where: { userId: commenter.id, questKey: "suggest_criteria" } }))?.doneAt).not.toBeNull();
    const cs = await listProposalComments(db, { proposalId });
    expect(cs.items.map((c) => c.body)).toEqual(["Nên giữ tiêu chí thời gian"]);
    expect(await db.notification.count({ where: { userId: author.id, kind: "proposal_comment" } })).toBe(1);

    const detail = await getProposal(db, { proposalId, viewerId: voter });
    expect(detail).toMatchObject({
      kind: "edit_criteria",
      title: "Đổi phiếu",
      targetLevel: 4,
      myVote: "disagree",
      myWeight: 1,
      commentCount: 1,
      rule: { agree_ratio: 0.7, min_votes: 30, voter_min_level: 5 },
      supportRule: null,
      mySupport: false,
    });
    expect(detail.currentCriteria?.length).toBeGreaterThan(0);
    const list = await listProposals(db, { skillSlug: skill.slug, kind: "edit_criteria", status: "voting" });
    expect(list.items.map((i) => i.id)).toContain(proposalId);
  });
});
