import { describe, expect, it } from "vitest";
import {
  REPORT_REASON_LABELS,
  fileAppealInput,
  reportDuringReviewInput,
  reportReason,
  resolveAppealInput,
  submitReviewInput,
} from "../src";

const A = "11111111-1111-4111-8111-111111111111";
const C1 = "22222222-2222-4222-8222-222222222222";
const C2 = "33333333-3333-4333-8333-333333333333";

describe("submitReviewInput", () => {
  it("pass chỉ khi mọi tiêu chí đạt; fail cần ít nhất một chưa đạt", () => {
    const all = [{ criterionId: C1, met: true }, { criterionId: C2, met: true }];
    const some = [{ criterionId: C1, met: false }, { criterionId: C2, met: true }];
    expect(submitReviewInput.safeParse({ assignmentId: A, verdict: "pass", marks: all }).success).toBe(true);
    expect(submitReviewInput.safeParse({ assignmentId: A, verdict: "fail", marks: some, comment: " ok " }).data?.comment).toBe("ok");
    expect(submitReviewInput.safeParse({ assignmentId: A, verdict: "pass", marks: some }).success).toBe(false);
    expect(submitReviewInput.safeParse({ assignmentId: A, verdict: "fail", marks: all }).success).toBe(false);
  });
  it("không cho trùng tiêu chí hoặc rỗng", () => {
    expect(submitReviewInput.safeParse({ assignmentId: A, verdict: "pass", marks: [] }).success).toBe(false);
    expect(
      submitReviewInput.safeParse({ assignmentId: A, verdict: "pass", marks: [{ criterionId: C1, met: true }, { criterionId: C1, met: true }] }).success,
    ).toBe(false);
  });
});

describe("báo cáo / kháng nghị", () => {
  it("lý do báo cáo khớp enum DB và có nhãn tiếng Việt", () => {
    expect(Object.keys(REPORT_REASON_LABELS).sort()).toEqual([...reportReason.options].sort());
    expect(reportDuringReviewInput.safeParse({ assignmentId: A, reason: "spam" }).success).toBe(false);
    expect(reportDuringReviewInput.parse({ assignmentId: A, reason: "edited" }).reason).toBe("edited");
  });
  it("kháng nghị cần lý do ≥ 10 ký tự; quyết định upheld|overturned", () => {
    expect(fileAppealInput.safeParse({ proofId: A, reason: "ngắn" }).success).toBe(false);
    expect(fileAppealInput.safeParse({ proofId: A, reason: "Góc quay khác cho thấy rõ" }).success).toBe(true);
    expect(resolveAppealInput.safeParse({ appealId: A, decision: "open" }).success).toBe(false);
  });
});
