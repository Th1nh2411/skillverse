/**
 * D72 — cấp hiển thị như "mốc" có tên: levelTitle trên mọi view, hướng dẫn tách khỏi tiêu chí, biên tập viên sửa mốc,
 * bài lên cấp "xong mốc", payload đề xuất kỹ năng mới có tên mốc (payload cũ vẫn đọc được).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  decideNewSkill,
  finalizeProof,
  getHomeFeed,
  getLevelUpSummary,
  getProfile,
  getReviewQueue,
  getSkillDetail,
  getSkillTree,
  levelUpPostBody,
  listUserSkills,
  loadLevelTitles,
  milestoneLabel,
  parseNewSkillPayload,
  submitProof,
  updateMilestone,
} from "../src";
import { closeTestDb, fx, getTestDb, resetDb, setConfig, type FxSkill } from "../src/testing";
import { hash, NOW, proofThroughLoop, rng } from "./helpers";

const db = getTestDb();
const TITLES = ["Mồi lửa", "Đá lửa", "Trời gió", "Trời mưa", "Không dụng cụ"];

let cat: { id: string; slug: string };
let editor: { id: string };
let base: FxSkill;
let fire: FxSkill;
let me: string;

async function nameLevels(skill: FxSkill, titles: string[]) {
  for (const [i, title] of titles.entries()) {
    await db.skillLevel.update({
      where: { id: skill.levels.get(i + 1)!.levelId },
      data: { title, description: `Hướng dẫn ${title}` },
    });
  }
}

beforeAll(async () => {
  await resetDb(db);
  cat = await fx.category(db, { slug: "moc-t", name: "Mốc" });
  editor = await fx.user(db, { isEditor: true });
  base = await fx.skill(db, { categoryId: cat.id, slug: "co-ban-m", name: "Cơ bản", criteria: (lv) => [`Việc cơ bản ${lv}`] });
  fire = await fx.skill(db, { categoryId: cat.id, slug: "nhom-lua-m", name: "Nhóm lửa", criteria: (lv) => [`Việc lửa ${lv}`] });
  await nameLevels(base, ["Bước một", "Bước hai", "Bước ba", "Bước bốn", "Bước năm"]);
  await nameLevels(fire, TITLES);
  await fx.edge(db, base.id, fire.id, 2);
  me = (await fx.user(db)).id;
  await fx.setUserSkillLevel(db, me, base.id, 2);
  await fx.setUserSkillLevel(db, me, fire.id, 2);
});

afterAll(async () => {
  await closeTestDb();
});

describe("hàm thuần", () => {
  it("nhãn mốc + nội dung bài lên cấp, dự phòng số cấp khi chưa có tên", () => {
    expect(milestoneLabel("Trời gió", 3)).toBe("mốc Trời gió");
    expect(milestoneLabel(null, 3)).toBe("cấp 3");
    expect(milestoneLabel("  ", 3)).toBe("cấp 3");
    expect(levelUpPostBody("Nhóm lửa", "Trời gió", 3)).toBe("Nhóm lửa: xong mốc Trời gió");
    expect(levelUpPostBody("Nhóm lửa", null, 3)).toBe("Nhóm lửa: lên cấp 3");
  });

  it("đọc payload kỹ năng mới cũ (không tên mốc) và mới", () => {
    const old = parseNewSkillPayload({
      name: "Cũ",
      categorySlug: "x",
      description: null,
      riskLevel: "low",
      levels: [{ level: 1, criteria: [{ text: "A", kind: "checklist" }] }, [{ text: "B" }]],
    });
    expect(old.levels).toEqual([
      { level: 1, title: null, description: null, criteria: [{ text: "A", kind: "checklist", threshold: null }] },
      { level: 2, title: null, description: null, criteria: [{ text: "B", kind: "checklist", threshold: null }] },
    ]);
    expect(old.riskLevel).toBe("low");
    const cur = parseNewSkillPayload({ levels: [{ level: 1, title: "Con hạc", description: "Gấp", criteria: [{ text: "Gấp hạc" }] }] });
    expect(cur.levels[0]).toMatchObject({ title: "Con hạc", description: "Gấp" });
  });

  it("loadLevelTitles: level 0 / không có → null", async () => {
    const t = await loadLevelTitles(db, [fire.id]);
    expect(t(fire.id, 3)).toBe("Trời gió");
    expect(t(fire.id, 0)).toBeNull();
    expect(t(fire.id, 9)).toBeNull();
    expect(t(base.id, 1)).toBeNull();
  });
});

describe("view có tên mốc", () => {
  it("cây kỹ năng: levelTitle, nextLevelTitle, requiredLevelTitle trên cạnh + điều kiện", async () => {
    const tree = await getSkillTree(db, { userId: me, categorySlug: cat.slug });
    const node = tree.nodes.find((n) => n.slug === fire.slug)!;
    expect(node).toMatchObject({ level: 2, levelTitle: "Đá lửa", maxLevel: 5, nextLevelTitle: "Trời gió" });
    expect(node.next).toMatchObject({ level: 3, title: "Trời gió", description: "Hướng dẫn Trời gió", task: "Việc lửa 3" });
    expect(node.prerequisites[0]).toMatchObject({ requiredLevel: 2, requiredLevelTitle: "Bước hai", userLevelTitle: "Bước hai", met: true });
    expect(tree.edges).toContainEqual({ parentSkillId: base.id, childSkillId: fire.id, requiredLevel: 2, requiredLevelTitle: "Bước hai" });
  });

  it("chi tiết kỹ năng: mỗi mốc có title/description/task; mốc kế tiếp của người xem", async () => {
    const d = await getSkillDetail(db, { slug: fire.slug, userId: me });
    expect(d.levels.map((l) => l.title)).toEqual(TITLES);
    expect(d.levels[0]).toMatchObject({ description: "Hướng dẫn Mồi lửa", task: "Việc lửa 1", criteria: [{ text: "Việc lửa 1" }] });
    expect(d).toMatchObject({ myLevel: 2, myLevelTitle: "Đá lửa" });
    expect(d.nextMilestone).toEqual({
      skillLevelId: fire.levels.get(3)!.levelId,
      level: 3,
      title: "Trời gió",
      description: "Hướng dẫn Trời gió",
      task: "Việc lửa 3",
    });
    expect(d.parents[0]).toMatchObject({ requiredLevel: 2, requiredLevelTitle: "Bước hai" });
    const b = await getSkillDetail(db, { slug: base.slug, userId: null });
    expect(b.children[0]).toMatchObject({ requiredLevel: 2, requiredLevelTitle: "Bước hai" });
    // Chưa đăng nhập / chưa theo → mốc 1
    expect(b).toMatchObject({ myLevel: null, myLevelTitle: null, nextMilestone: { level: 1, title: "Bước một" } });
  });

  it("hồ sơ + kỹ năng người dùng: levelTitle, nextLevelTitle, maxLevel; đạt mốc cuối → nextLevelTitle null", async () => {
    const u = await fx.user(db);
    await fx.setUserSkillLevel(db, u.id, fire.id, 5);
    await fx.setUserSkillLevel(db, u.id, base.id, 1);
    await fx.proof(db, { userId: u.id, skill: base, targetLevel: 2, status: "in_review" });
    const p = await getProfile(db, { userId: u.id });
    expect(p.featuredSkills.find((f) => f.slug === fire.slug)).toMatchObject({
      level: 5,
      levelTitle: "Không dụng cụ",
      maxLevel: 5,
      nextLevelTitle: null,
    });
    expect(p.featuredSkills.find((f) => f.slug === base.slug)).toMatchObject({
      levelTitle: "Bước một",
      nextLevelTitle: "Bước hai",
      pendingTargetLevel: 2,
      pendingLevelTitle: "Bước hai",
    });
    const list = await listUserSkills(db, { userId: u.id });
    expect(list.find((s) => s.slug === base.slug)).toMatchObject({ level: 1, levelTitle: "Bước một", maxLevel: 5, nextLevelTitle: "Bước hai" });
  });

  it("vòng duyệt: hàng đợi có levelTitle, bài lên cấp 'xong mốc', feed + tóm tắt lên cấp có tên mốc", async () => {
    const { skill, submitter, proofId } = await proofThroughLoop(db, { categoryId: cat.id });
    await db.skillLevel.update({ where: { id: skill.levels.get(1)!.levelId }, data: { title: "Khởi động" } });
    // proofThroughLoop đã chốt với tên mặc định "Cấp 1"
    const post = await db.post.findFirstOrThrow({ where: { proofId, kind: "level_up" } });
    expect(post.body).toBe(`${skill.name}: xong mốc Cấp 1`);
    const feed = await getHomeFeed(db, { userId: submitter.id });
    expect(feed.items[0]).toMatchObject({ kind: "level_up", levelUp: { proofId, level: 1, levelTitle: "Khởi động" } });
    const sum = await getLevelUpSummary(db, { proofId, userId: submitter.id });
    expect(sum).toMatchObject({ level: 1, levelTitle: "Khởi động", nextLevelTitle: "Cấp 2" });
  });

  it("finalizeProof: kết quả passed có levelTitle; mốc chưa có tên → 'lên cấp N'; thu hồi trả tên mốc", async () => {
    const skill = await fx.skill(db, { categoryId: cat.id });
    await db.skillLevel.update({ where: { id: skill.levels.get(1)!.levelId }, data: { title: null } });
    const submitter = await fx.user(db);
    const reviewers = [];
    for (let i = 0; i < 3; i++) {
      const r = await fx.user(db, { reputation: 70 + i });
      await fx.setUserSkillLevel(db, r.id, skill.id, 5);
      reviewers.push(r);
    }
    const { proofId } = await submitProof(db, {
      userId: submitter.id,
      skillId: skill.id,
      targetLevel: 1,
      mediaUrl: "proofs/m.mp4",
      mediaHash: hash(),
      now: NOW,
      rng,
    });
    const q = await getReviewQueue(db, { reviewerId: reviewers[0]!.id, now: NOW });
    expect(q.items.find((i) => i.targetLevel === 1 && i.skill.slug === skill.slug)).toMatchObject({ levelTitle: null });
    const as = await db.reviewAssignment.findMany({ where: { proofId } });
    for (const a of as) await fx.review(db, { assignmentId: a.id, verdict: "pass" });
    const r = await finalizeProof(db, { proofId, now: NOW, rng });
    expect(r).toMatchObject({ outcome: "passed", newLevel: 1, levelTitle: null });
    expect((await db.post.findFirstOrThrow({ where: { proofId } })).body).toBe(`${skill.name}: lên cấp 1`);

    await db.skillLevel.update({ where: { id: skill.levels.get(1)!.levelId }, data: { title: "Khởi đầu" } });
    const rv = await finalizeProof(db, { proofId, now: NOW, revoke: { byUserId: editor.id, reason: "gian lận" } });
    expect(rv).toMatchObject({ outcome: "revoked", newLevel: 0, levelTitle: "Khởi đầu", newLevelTitle: null });
  });

  it("nộp sai mốc / thiếu kỹ năng cha → thông báo dùng tên mốc", async () => {
    const u = await fx.user(db);
    await expect(
      submitProof(db, { userId: u.id, skillId: fire.id, targetLevel: 2, mediaUrl: "proofs/x.mp4", mediaHash: hash(), now: NOW, rng }),
    ).rejects.toThrow(/mốc Mồi lửa/);
    await expect(
      submitProof(db, { userId: u.id, skillId: fire.id, targetLevel: 1, mediaUrl: "proofs/y.mp4", mediaHash: hash(), now: NOW, rng }),
    ).rejects.toThrow(/Cơ bản mốc Bước hai/);
  });
});

describe("biên tập viên sửa mốc", () => {
  it("chỉ biên tập viên; sửa tên/hướng dẫn, không tạo criteria_versions, không đổi tiêu chí", async () => {
    const lv = fire.levels.get(4)!;
    const versionsBefore = await db.criteriaVersion.count({ where: { skillLevelId: lv.levelId } });
    await expect(updateMilestone(db, { editorId: me, skillLevelId: lv.levelId, title: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const r = await updateMilestone(db, { editorId: editor.id, skillLevelId: lv.levelId, title: "  Mưa phùn ", description: " Tìm bùi nhùi khô. " });
    expect(r).toEqual({ skillLevelId: lv.levelId, skillId: fire.id, level: 4, title: "Mưa phùn", description: "Tìm bùi nhùi khô." });
    const keepTitle = await updateMilestone(db, { editorId: editor.id, skillLevelId: lv.levelId, description: "" });
    expect(keepTitle).toMatchObject({ title: "Mưa phùn", description: null });
    const row = await db.skillLevel.findUniqueOrThrow({ where: { id: lv.levelId }, include: { currentVersion: { include: { criteria: true } } } });
    expect(row.currentVersionId).toBe(lv.versionId);
    expect(row.currentVersion?.criteria.map((c) => c.text)).toEqual(["Việc lửa 4"]);
    expect(await db.criteriaVersion.count({ where: { skillLevelId: lv.levelId } })).toBe(versionsBefore);

    await expect(updateMilestone(db, { editorId: editor.id, skillLevelId: lv.levelId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(updateMilestone(db, { editorId: editor.id, skillLevelId: lv.levelId, title: "  " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      updateMilestone(db, { editorId: editor.id, skillLevelId: lv.levelId, description: "x".repeat(301) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      updateMilestone(db, { editorId: editor.id, skillLevelId: "00000000-0000-4000-8000-000000000000", title: "A" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("đề xuất kỹ năng mới dạng cũ vẫn chấp nhận được", () => {
  it("payload không có tên mốc → skill_levels.title = null", async () => {
    await setConfig(db, "new_skill_defaults", { xp_per_level: 100, min_reviewers: 3, reviewer_level_offset: 1 });
    const author = await fx.user(db);
    const pr = await db.proposal.create({
      data: {
        kind: "new_skill",
        authorId: author.id,
        status: "editor_review",
        supportCount: 50,
        payload: {
          name: "Kỹ năng đời cũ",
          categorySlug: cat.slug,
          description: null,
          riskLevel: "none",
          levels: [1, 2, 3].map((level) => ({ level, criteria: [{ text: `Cũ ${level}`, kind: "checklist" }] })),
        },
      },
    });
    const d = await decideNewSkill(db, { proposalId: pr.id, editorId: editor.id, decision: "accepted", now: NOW });
    const levels = await db.skillLevel.findMany({ where: { skillId: d.skillId! }, orderBy: { level: "asc" } });
    expect(levels.map((l) => [l.level, l.title, l.description])).toEqual([
      [1, null, null],
      [2, null, null],
      [3, null, null],
    ]);
  });
});
