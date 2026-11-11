import { createHash } from "node:crypto";
import type { HeadResult, Storage } from "../src/storage";

/** Kho giả trong bộ nhớ cho test router (không cần MinIO). */
export class MemoryStorage implements Storage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body, contentType });
  }
  async presignPut(key: string, contentType: string, expiresInS: number) {
    return `https://storage.test/put/${key}?ct=${encodeURIComponent(contentType)}&exp=${expiresInS}`;
  }
  async presignGet(key: string, expiresInS: number) {
    return `https://storage.test/get/${key}?exp=${expiresInS}`;
  }
  async head(key: string): Promise<HeadResult | null> {
    const o = this.objects.get(key);
    return o ? { size: o.body.length, contentType: o.contentType } : null;
  }
  async sha256(key: string) {
    const o = this.objects.get(key);
    if (!o) throw new Error("NoSuchKey");
    return createHash("sha256").update(o.body).digest("hex");
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}
