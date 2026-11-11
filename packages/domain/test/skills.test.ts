import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DomainError, getSkillDetail, getSkillTree } from "../src";
import { closeTestDb, fx, getTestDb, resetDb, type FxSkill } from "../src/testing";

const db = getTestDb();

let catSlug: string;
let base: FxSkill, fire: FxSkill, friction: FxSkill, water: FxSkill;
let me: string, other: string, expert: string;

beforeAll(async () => {
  await resetDb(db);
  const cat = await fx.category(db, { slug: "sinh-ton-t", name: "Sinh tồn" });
  catSlug = cat.slug;
  base = await fx.skill(db, { categoryId: cat.id, slug: "co-ban-t", name: "Sinh tồn cơ bản", holderCount: 820 });
  fire = await fx.skill(db, { categoryId: cat.id, slug: "nhom-lua-t", name: "Nhóm lửa", holderCount: 640 });
  friction = await fx.skill(db, {
    categoryId: cat.id,
    slug: "lua-que-t",
    name: "Lửa bằng que",
    holderCount: 214,
    riskLevel: "high",
    criteria: (lv) => [`Que cấp ${lv}`, "Video liên tục"],
  });
  water = await fx.skill(db, { categoryId: cat.id, slug: "nuoc-t", name: "Tìm nước", holderCount: 30 });
  await fx.edge(db, base.id, fire.id, 1);
  await fx.edge(db, fire.id, friction.id, 2);
  await fx.edge(db, base.id, water.id, 3);

  me = (await fx.user(db)).id;
  other = (await fx.user(db)).id;
  expert = (await fx.user(db)).id;
  await fx.setUserSkillLevel(db, me, base.id, 5);
  await fx.setUserSkillLevel(db, me, fire.id, 2);
  await fx.setUserSkillLevel(db, me, friction.id, 3);
  await fx.setUserSkillLevel(db, other, friction.id, 4);
  await fx.setUserSkillLevel(db, expert, friction.id, 5);
  await fx.proof(db, { userId: me, skill: friction, targetLevel: 4, status: "in_review" });
});

afterAll(async () => {
  await closeTestDb();
});

describe("getSkillTree", () => {
  it("trạng thái nút theo user_skills + skill_edges", async () => {
    const tree = await getSkillTree(db, { userId: me, categorySlug: catSlug });
    const node = (slug: string) => tree.nodes.find((n) => n.slug === slug)!;
    expect(tree.totalCount).toBe(4);
    expect(node("co-ban-t").state).toBe("achieved");
    expect(node("nhom-lua-t").state).toBe("practicing");
    expect(node("lua-que-t").state).toBe("practicing");
    expect(node("lua-que-t").level).toBe(3);
    // Tìm nước cần Sinh tồn cơ bản cấp 3 → đã đạt (5) → practicing ở cấp 0
    expect(node("nuoc-t").state).toBe("practicing");
    expect(node("nuoc-t").level).toBe(0);
    expect(tree.unlockedCount).toBe(4);
    expect(tree.edges).toHaveLength(3);
  });

  it("locked khi kỹ năng cha chưa đạt required_level", async () => {
    const tree = await getSkillTree(db, { userId: other, categorySlug: catSlug });
    const fr = tree.nodes.find((n) => n.slug === "lua-que-t")!;
    // other có cấp 4 ở lửa bằng que nhưng chưa đạt Nhóm lửa cấp 2 → locked
    expect(fr.state).toBe("locked");
    expect(fr.prerequisites).toEqual([
      expect.objectContaining({ slug: "nhom-lua-t", requiredLevel: 2, userLevel: 0, met: false }),
    ]);
  });

  it("yêu cầu cấp kế tiếp + số người đã đạt cấp đó + chờ duyệt + độ hiếm", async () => {
    const tree = await getSkillTree(db, { userId: me, categorySlug: catSlug });
    const fr = tree.nodes.find((n) => n.slug === "lua-que-t")!;
    expect(fr.next?.level).toBe(4);
    expect(fr.next?.xpReward).toBe(400);
    expect(fr.next?.criteria.map((c) => c.text)).toEqual(["Que cấp 4", "Video liên tục"]);
    expect(fr.next?.holdersAtOrAbove).toBe(2);
    expect(fr.pendingProof).toMatchObject({ targetLevel: 4, status: "in_review" });
    expect(fr.rarity).toBe("rare");
    expect(tree.nodes.find((n) => n.slug === "nuoc-t")!.rarity).toBe("legendary");
    expect(tree.nodes.find((n) => n.slug === "co-ban-t")!.next).toBeNull();
  });

  it("không đăng nhập: mọi nút level 0, nút gốc mở", async () => {
    const tree = await getSkillTree(db, { userId: null, categorySlug: catSlug });
    expect(tree.nodes.find((n) => n.slug === "co-ban-t")!.state).toBe("practicing");
    expect(tree.nodes.find((n) => n.slug === "nhom-lua-t")!.state).toBe("locked");
  });

  it("danh mục không tồn tại → NOT_FOUND", async () => {
    await expect(getSkillTree(db, { userId: me, categorySlug: "khong-co" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("getSkillDetail", () => {
  it("5 cấp kèm tiêu chí phiên bản hiện tại, số đang luyện, số đạt cấp ≥ 4", async () => {
    const d = await getSkillDetail(db, { slug: "lua-que-t", userId: me });
    expect(d.levels).toHaveLength(5);
    expect(d.levels[0]?.criteriaVersion).toBe(1);
    expect(d.levels[4]?.criteria.map((c) => c.text)).toEqual(["Que cấp 5", "Video liên tục"]);
    expect(d.riskLevel).toBe("high");
    expect(d.rarity).toBe("rare");
    expect(d.practicingCount).toBe(2); // me (3), other (4)
    expect(d.advancedMinLevel).toBe(4);
    expect(d.advancedCount).toBe(2); // other (4), expert (5)
    expect(d.myLevel).toBe(3);
    expect(d.myPrerequisitesMet).toBe(true);
    expect(d.myPendingProof?.targetLevel).toBe(4);
    expect(d.parents.map((p) => p.slug)).toEqual(["nhom-lua-t"]);
  });

  it("phiên bản tiêu chí mới được dùng khi current_version_id đổi", async () => {
    const lv2 = friction.levels.get(2)!;
    const v2 = await db.criteriaVersion.create({
      data: { skillLevelId: lv2.levelId, version: 2, criteria: { create: [{ position: 1, text: "Tiêu chí mới" }] } },
    });
    await db.skillLevel.update({ where: { id: lv2.levelId }, data: { currentVersionId: v2.id } });
    const d = await getSkillDetail(db, { slug: "lua-que-t" });
    expect(d.levels[1]?.criteriaVersion).toBe(2);
    expect(d.levels[1]?.criteria.map((c) => c.text)).toEqual(["Tiêu chí mới"]);
    expect(d.myLevel).toBeNull();
  });

  it("đề xuất sửa tiêu chí đang mở với tỉ lệ có trọng số", async () => {
    const p = await db.proposal.create({
      data: {
        kind: "edit_criteria",
        authorId: other,
        skillId: friction.id,
        skillLevelId: friction.levels.get(4)!.levelId,
        payload: { summary: "Cấp 4: gỗ tự kiếm", criteria: [{ text: "Gỗ tự kiếm", kind: "checklist" }] },
        status: "voting",
      },
    });
    const v1 = (await fx.user(db)).id;
    const v2 = (await fx.user(db)).id;
    await db.proposalVote.createMany({
      data: [
        { proposalId: p.id, userId: expert, vote: "agree", weight: 1 },
        { proposalId: p.id, userId: v1, vote: "disagree", weight: 1 },
        { proposalId: p.id, userId: v2, vote: "agree", weight: 1 },
        { proposalId: p.id, userId: me, vote: "disagree", weight: 0 },
      ],
    });
    await db.proposal.create({
      data: { kind: "edit_criteria", authorId: other, skillId: friction.id, payload: {}, status: "rejected" },
    });
    const d = await getSkillDetail(db, { slug: "lua-que-t", userId: me });
    expect(d.openProposals).toHaveLength(1);
    const op = d.openProposals[0]!;
    expect(op.targetLevel).toBe(4);
    expect(op.summary).toBe("Cấp 4: gỗ tự kiếm");
    expect(op.voteCount).toBe(4);
    expect(op.weightedVoteCount).toBe(3);
    expect(op.agreeRatio).toBeCloseTo(2 / 3);
    expect(op.rule).toEqual({ agree_ratio: 0.7, min_votes: 30, voter_min_level: 5 });
    expect(op.myVote).toBe("disagree");
    expect(op.proposedCriteria).toEqual([{ text: "Gỗ tự kiếm", kind: "checklist" }]);
  });

  it("slug không tồn tại → DomainError NOT_FOUND", async () => {
    const err = await getSkillDetail(db, { slug: "khong-co" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("NOT_FOUND");
  });
});
