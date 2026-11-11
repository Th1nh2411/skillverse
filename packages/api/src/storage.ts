/**
 * Kho video bằng chứng (S3 API: MinIO local, Cloudflare R2 khi demo).
 * - Upload: presigned PUT thẳng từ trình duyệt tới S3_PUBLIC_ENDPOINT.
 * - Khóa object ngẫu nhiên, KHÔNG chứa dữ liệu cá nhân; gắn chữ ký HMAC(userId) để server
 *   xác minh người nộp đúng là người đã xin URL upload (không lưu bảng tạm).
 * - Xem: presigned GET có thời hạn (bucket private).
 * - SHA-256 tính ở server bằng cách đọc lại object sau upload (DECISIONS D20).
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type HeadResult = { size: number; contentType: string | null };

export interface Storage {
  /** URL PUT có thời hạn; client phải gửi đúng header Content-Type. */
  presignPut(key: string, contentType: string, expiresInS: number): Promise<string>;
  /** URL GET có thời hạn để xem video. */
  presignGet(key: string, expiresInS: number): Promise<string>;
  /** null nếu object chưa tồn tại. */
  head(key: string): Promise<HeadResult | null>;
  /** SHA-256 hex của toàn bộ object. */
  sha256(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export type S3Env = {
  endpoint?: string;
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function s3EnvFromProcess(env: NodeJS.ProcessEnv = process.env): S3Env {
  const bucket = env.S3_BUCKET;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) throw new Error("Thiếu cấu hình S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY");
  return {
    endpoint: env.S3_ENDPOINT || undefined,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT || undefined,
    region: env.S3_REGION || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

export class S3Storage implements Storage {
  private readonly internal: S3Client;
  /** Client riêng cho URL ký gửi về trình duyệt: chữ ký gắn với host công khai. */
  private readonly public: S3Client;
  private readonly bucket: string;

  constructor(cfg: S3Env) {
    const base = {
      region: cfg.region,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      // R2/MinIO: không thêm checksum CRC mặc định vào URL ký (trình duyệt không gửi được).
      requestChecksumCalculation: "WHEN_REQUIRED" as const,
      responseChecksumValidation: "WHEN_REQUIRED" as const,
    };
    this.internal = new S3Client({ ...base, endpoint: cfg.endpoint });
    this.public = new S3Client({ ...base, endpoint: cfg.publicEndpoint });
    this.bucket = cfg.bucket;
  }

  presignPut(key: string, contentType: string, expiresInS: number) {
    return getSignedUrl(this.public, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: expiresInS,
    });
  }

  presignGet(key: string, expiresInS: number) {
    return getSignedUrl(this.public, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInS });
  }

  async head(key: string): Promise<HeadResult | null> {
    try {
      const r = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? null };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (e as Error).name === "NotFound" || (e as Error).name === "NoSuchKey") return null;
      throw e;
    }
  }

  async sha256(key: string): Promise<string> {
    const r = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const hash = createHash("sha256");
    for await (const chunk of r.Body as Readable) hash.update(chunk as Buffer);
    return hash.digest("hex");
  }

  async delete(key: string): Promise<void> {
    await this.internal.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let defaultStorage: Storage | undefined;
/** Storage mặc định từ biến môi trường (tạo lười, để test/route không cần S3 vẫn import được). */
export function getStorage(): Storage {
  defaultStorage ??= new S3Storage(s3EnvFromProcess());
  return defaultStorage;
}

// ---------------------------------------------------------------------------
// Khóa object
// ---------------------------------------------------------------------------

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const KEY_RE = /^proofs\/([0-9a-f-]{36})-([0-9a-f]{24})\.([a-z0-9]{2,5})$/;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Thiếu AUTH_SECRET");
  return s;
}

function keySig(userId: string, id: string): string {
  return createHmac("sha256", secret()).update(`proof-upload:${userId}:${id}`).digest("hex").slice(0, 24);
}

export function extensionFor(contentType: string): string {
  return EXT[contentType] ?? "bin";
}

/** Khóa mới `proofs/<uuid>-<hmac>.<ext>` — không chứa id/handle người dùng. */
export function newProofMediaKey(userId: string, contentType: string): string {
  const id = randomUUID();
  return `proofs/${id}-${keySig(userId, id)}.${extensionFor(contentType)}`;
}

/** Khóa có phải do chính `userId` xin URL upload? */
export function isProofMediaKeyOwnedBy(key: string, userId: string): boolean {
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const expected = Buffer.from(keySig(userId, m[1]!));
  const got = Buffer.from(m[2]!);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
