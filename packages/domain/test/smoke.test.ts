import { describe, expect, it } from "vitest";
import { InlineJobRunner } from "../src/jobs";

describe("InlineJobRunner", () => {
  it("chạy handler đã đăng ký", async () => {
    let ran = false;
    const r = new InlineJobRunner({ closeExpiredProposals: async () => { ran = true; } });
    await r.enqueue("closeExpiredProposals");
    expect(ran).toBe(true);
  });
});
