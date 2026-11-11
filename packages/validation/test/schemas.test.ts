import { describe, expect, it } from "vitest";
import {
  discoverHomeInput,
  onboardingCompleteInput,
  profileByHandleInput,
  sha256Hex,
  skillDetailInput,
  skillSearchInput,
  skillTreeInput,
  submitProofInput,
} from "../src";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";

describe("schema kỹ năng / khám phá / hồ sơ", () => {
  it("slug hợp lệ", () => {
    expect(skillTreeInput.parse({ categorySlug: "sinh-ton" })).toEqual({ categorySlug: "sinh-ton" });
    expect(skillDetailInput.safeParse({ slug: "Lua Bang Que" }).success).toBe(false);
  });
  it("search: trim, giới hạn mặc định, chặn chuỗi rỗng", () => {
    expect(skillSearchInput.parse({ query: "  lửa " })).toEqual({ query: "lửa", limit: 20 });
    expect(skillSearchInput.safeParse({ query: "   " }).success).toBe(false);
    expect(skillSearchInput.safeParse({ query: "a", limit: 100 }).success).toBe(false);
  });
  it("discover.home cho phép bỏ trống input", () => {
    expect(discoverHomeInput.parse(undefined)).toEqual({});
    expect(discoverHomeInput.parse({ categorySlug: "ky-nang-di" })).toEqual({ categorySlug: "ky-nang-di" });
  });
  it("handle", () => {
    expect(profileByHandleInput.safeParse({ handle: "minhhoang" }).success).toBe(true);
    expect(profileByHandleInput.safeParse({ handle: "Minh Hoang" }).success).toBe(false);
  });
});

describe("onboardingCompleteInput", () => {
  it("≥ 3 kỹ năng, không trùng, selfLevels mặc định {}", () => {
    expect(onboardingCompleteInput.parse({ skillIds: [U1, U2, U3] })).toEqual({ skillIds: [U1, U2, U3], selfLevels: {} });
    expect(onboardingCompleteInput.safeParse({ skillIds: [U1, U2] }).success).toBe(false);
    expect(onboardingCompleteInput.safeParse({ skillIds: [U1, U1, U2] }).success).toBe(false);
    expect(onboardingCompleteInput.safeParse({ skillIds: [U1, U2, "x"] }).success).toBe(false);
  });
  it("selfLevels chỉ nhận beginner|some|proficient", () => {
    expect(
      onboardingCompleteInput.parse({ skillIds: [U1, U2, U3], selfLevels: { [U1]: "proficient" } }).selfLevels,
    ).toEqual({ [U1]: "proficient" });
    expect(onboardingCompleteInput.safeParse({ skillIds: [U1, U2, U3], selfLevels: { [U1]: 5 } }).success).toBe(false);
  });
});

describe("submitProofInput", () => {
  it("mặc định safetyAck=false, ép kiểu capturedAt", () => {
    const r = submitProofInput.parse({ skillId: U1, targetLevel: 2, mediaKey: "proofs/a.mp4", capturedAt: "2026-11-01T00:00:00Z" });
    expect(r.safetyAck).toBe(false);
    expect(r.capturedAt).toBeInstanceOf(Date);
    expect(submitProofInput.safeParse({ skillId: U1, targetLevel: 0, mediaKey: "x" }).success).toBe(false);
  });
  it("sha256Hex", () => {
    expect(sha256Hex.safeParse("a".repeat(64)).success).toBe(true);
    expect(sha256Hex.safeParse("A".repeat(64)).success).toBe(false);
  });
});
