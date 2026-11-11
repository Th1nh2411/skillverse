import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getConfig } from "@skillverse/domain";
import { closeTestDb, fx, getTestDb, resetDb, setConfig, type FxSkill } from "@skillverse/domain/testing";
import { appRouter, createCallerFactory, createContext, createSessionFor, getSessionUser, runCron, type SessionUser } from "../src";
import { MemoryStorage } from "./helpers";

const db = getTestDb();
const createCaller = createCallerFactory(appRouter);
const caller = async (user: SessionUser | null) => createCaller(await createContext({ db, user, storage: new MemoryStorage() }));
const ID = "00000000-0000-4000-8000-000000000000";

let skill: FxSkill;
let author: SessionUser;
let fans: SessionUser[];
let editor: SessionUser;
let originalSupport: unknown;

async function viewer(userId: string): Promise<SessionUser> {
  return (await getSessionUser(db, (await createSessionFor(db, userId)).sessionToken))!;
}
async function expectCode(p: Promise<unknown>, code: TRPCError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof TRPCError && e.code === code);
}
const levels = [1, 2, 3].map((lv) => [{ text: `Tiêu chí cấp ${lv}`, kind: "checklist" as const }]);

beforeAll(async () => {
  await resetDb(db);
  originalSupport = await getConfig(db, "new_skill_support_needed");
  await setConfig(db, "new_skill_support_needed", { supporters: 3, days: 14 });
  const cat = await fx.category(db, { slug: "ky-nang-di", name: "Kỹ năng dị" });
  skill = await fx.skill(db, { categoryId: cat.id, slug: "tung-hung", name: "Tung hứng" });
  author = await viewer((await fx.user(db, { handle: "tacgia" })).id);
  fans = [];
  for (const h of ["fan_a", "fan_b"]) fans.push(await viewer((await fx.user(db, { handle: h })).id));
  editor = await viewer((await fx.user(db, { handle: "bientap", isEditor: true })).id);
});

afterAll(async () => {
  await setConfig(db, "new_skill_support_needed", originalSupport);
  await closeTestDb();
});

describe("proposal.* — quyền + validate", () => {
  it("chưa đăng nhập → UNAUTHORIZED", async () => {
    const c = await caller(null);
    await expectCode(c.proposal.list(), "UNAUTHORIZED");
    await expectCode(c.proposal.get({ proposalId: ID }), "UNAUTHORIZED");
    await expectCode(c.proposal.support({ proposalId: ID }), "UNAUTHORIZED");
    await expectCode(c.proposal.vote({ proposalId: ID, vote: "agree" }), "UNAUTHORIZED");
    await expectCode(c.proposal.comment({ proposalId: ID, body: "x" }), "UNAUTHORIZED");
    await expectCode(c.proposal.createNewSkill({ name: "Abc", categorySlug: "ky-nang-di", levels }), "UNAUTHORIZED");
  });

  it("input sai → BAD_REQUEST (ít hơn 3 cấp, tiêu chí trống, phiếu lạ)", async () => {
    const c = await caller(author);
    await expectCode(c.proposal.createNewSkill({ name: "Abc", categorySlug: "ky-nang-di", levels: levels.slice(0, 2) }), "BAD_REQUEST");
    await expectCode(c.proposal.createNewSkill({ name: "Abc", categorySlug: "ky-nang-di", levels: [[], [], []] }), "BAD_REQUEST");
    await expectCode(c.proposal.vote({ proposalId: ID, vote: "maybe" as "agree" }), "BAD_REQUEST");
    await expectCode(
      c.proposal.createCriteriaEdit({ skillLevelId: skill.levels.get(1)!.levelId, criteria: [{ text: "Tiêu chí mới", kind: "checklist" }], summary: "x" }),
      "BAD_REQUEST",
    );
  });

  it("admin.proposals / decideProposal: người thường FORBIDDEN", async () => {
    const c = await caller(author);
    await expectCode(c.admin.proposals(), "FORBIDDEN");
    await expectCode(c.admin.decideProposal({ proposalId: ID, decision: "accepted" }), "FORBIDDEN");
  });
});

describe("luồng kỹ năng mới: đề xuất → ủng hộ → biên tập duyệt", () => {
  it("đủ ủng hộ → editor_review → biên tập viên chấp nhận tạo kỹ năng", async () => {
    const { proposalId } = await (await caller(author)).proposal.createNewSkill({
      name: "Xếp giấy origami",
      categorySlug: "ky-nang-di",
      description: "Gấp hình bằng giấy",
      levels,
    });
    await (await caller(author)).proposal.comment({ proposalId, body: "Mời mọi người góp ý" });
    expect((await (await caller(fans[0]!)).proposal.comments({ proposalId })).items).toHaveLength(1);

    // Tác giả tự động là người ủng hộ đầu tiên; ngưỡng 3 → cần cả 2 người hâm mộ
    let status = "";
    for (const f of fans) status = (await (await caller(f)).proposal.support({ proposalId })).status;
    expect(status).toBe("editor_review");
    // Đã sang editor_review → không nhận ủng hộ thêm
    await expectCode((await caller(fans[0]!)).proposal.support({ proposalId }), "PRECONDITION_FAILED");

    const queue = await (await caller(editor)).admin.proposals();
    expect(queue.items.map((p: { id: string }) => p.id)).toContain(proposalId);
    const decided = await (await caller(editor)).admin.decideProposal({ proposalId, decision: "accepted" });
    expect(decided).toMatchObject({ status: "accepted" });
    expect(decided.skillSlug).toBeTruthy();
    expect((await (await caller(author)).proposal.get({ proposalId })).status).toBe("accepted");
  });

  it("sửa tiêu chí: tạo đề xuất + bỏ phiếu (trọng số 0 với người chưa đạt cấp yêu cầu)", async () => {
    const { proposalId } = await (await caller(author)).proposal.createCriteriaEdit({
      skillLevelId: skill.levels.get(1)!.levelId,
      criteria: [{ text: "Tung 3 bóng trong 30 giây", kind: "checklist" }],
      summary: "Rõ ràng hơn về thời gian",
    });
    const v = await (await caller(fans[0]!)).proposal.vote({ proposalId, vote: "agree" });
    expect(v.myVote).toBe("agree");
    expect(v.myWeight).toBe(0);
  });

  it("cron chạy closeExpiredProposals thật", async () => {
    const r = await runCron(db);
    expect(r.closeExpiredProposals).toMatchObject({ ok: true });
    expect(r.closeExpiredProposals?.result).toHaveProperty("criteriaClosed");
  });
});
