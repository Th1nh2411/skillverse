import { describe, expect, it } from "vitest";
import {
  SANCTION_KIND_LABELS,
  createReportInput,
  feedInput,
  postReactInput,
  proposeSwapInput,
  rateSwapInput,
  sanctionKindInput,
  sanctionUserInput,
  sendMessageInput,
} from "../src";

const U = "11111111-1111-4111-8111-111111111111";

describe("schema giai đoạn 3", () => {
  it("feed mặc định, react mặc định cheer + on", () => {
    expect(feedInput.parse(undefined)).toEqual({ limit: 20 });
    expect(postReactInput.parse({ postId: U })).toEqual({ postId: U, kind: "cheer", on: true });
    expect(postReactInput.safeParse({ postId: U, kind: "angry" }).success).toBe(false);
  });
  it("báo cáo, xử phạt (không cho level_revoked qua form)", () => {
    expect(createReportInput.safeParse({ targetType: "post", targetId: U, reason: "harassment" }).success).toBe(true);
    expect(createReportInput.safeParse({ targetType: "comment", targetId: U, reason: "other" }).success).toBe(false);
    expect(sanctionUserInput.safeParse({ userId: U, kind: "level_revoked", reason: "abc" }).success).toBe(false);
    expect(Object.keys(SANCTION_KIND_LABELS).sort()).toEqual([...sanctionKindInput.options].sort());
  });
  it("trao đổi + nhắn tin", () => {
    expect(proposeSwapInput.safeParse({ receiverHandle: "quocbao", teachSkillId: U, learnSkillId: U, mode: "video" }).success).toBe(true);
    expect(rateSwapInput.safeParse({ swapId: U, stars: 6 }).success).toBe(false);
    expect(sendMessageInput.safeParse({ threadId: U, body: "   " }).success).toBe(false);
  });
});
