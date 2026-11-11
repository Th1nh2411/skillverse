/**
 * Kiểm thử tích hợp S3Storage với MinIO local (docker compose). Tự bỏ qua nếu MinIO không chạy.
 * Xác nhận: URL PUT ký sẵn dùng được từ "trình duyệt" (fetch), head/sha256/GET ký sẵn/xóa.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newProofMediaKey, S3Storage } from "../src/storage";

const endpoint = process.env.S3_TEST_ENDPOINT ?? "http://localhost:9000";
const reachable = await fetch(`${endpoint}/minio/health/live`, { signal: AbortSignal.timeout(1500) })
  .then((r) => r.ok)
  .catch(() => false);

describe.skipIf(!reachable)("S3Storage (MinIO)", () => {
  const storage = new S3Storage({
    endpoint,
    publicEndpoint: endpoint,
    region: "auto",
    bucket: process.env.S3_TEST_BUCKET ?? "skillverse-proofs",
    accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? "minioadmin",
  });

  it("presigned PUT → head → sha256 → presigned GET → delete", async () => {
    process.env.AUTH_SECRET ??= "test-secret";
    const key = newProofMediaKey("00000000-0000-4000-8000-000000000001", "video/mp4");
    const body = Buffer.from("noi-dung-video-mau-".repeat(500));

    const putUrl = await storage.presignPut(key, "video/mp4", 60);
    const put = await fetch(putUrl, { method: "PUT", body, headers: { "Content-Type": "video/mp4" } });
    expect(put.status).toBe(200);

    expect(await storage.head(key)).toEqual({ size: body.length, contentType: "video/mp4" });
    expect(await storage.sha256(key)).toBe(createHash("sha256").update(body).digest("hex"));

    const get = await fetch(await storage.presignGet(key, 60));
    expect(Buffer.from(await get.arrayBuffer()).equals(body)).toBe(true);

    // Bucket private: không có chữ ký → bị từ chối
    expect((await fetch(`${endpoint}/skillverse-proofs/${key}`)).status).toBe(403);

    await storage.delete(key);
    expect(await storage.head(key)).toBeNull();
  });
});
