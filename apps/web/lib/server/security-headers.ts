/**
 * Header bảo mật cho mọi response (dùng trong `headers()` của next.config.ts — không import gì
 * để next.config nạp được). CSP "vừa đủ":
 * - script/style 'unsafe-inline' vì App Router chèn script inline (không dùng nonce để giữ trang tĩnh được);
 * - kho video (MinIO/R2) cho upload presigned PUT (connect-src) và xem video presigned GET (media-src);
 * - font tự host qua next/font (font-src 'self'), ảnh đại diện Google (googleusercontent);
 * - form-action gồm accounts.google.com vì Chrome áp form-action cho chuyển hướng sau POST đăng nhập.
 */
export type HeaderKV = { key: string; value: string };

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp(env: Record<string, string | undefined> = process.env): string {
  const isDev = env.NODE_ENV !== "production";
  const storage = [...new Set([origin(env.S3_PUBLIC_ENDPOINT), origin(env.S3_ENDPOINT)].filter(Boolean))].join(" ");
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob: https://*.googleusercontent.com",
    "font-src": "'self' data:",
    "media-src": `'self' blob: ${storage}`.trim(),
    "connect-src": `'self' ${storage}`.trim(),
    "worker-src": "'self' blob:",
    "manifest-src": "'self'",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self' https://accounts.google.com",
    "frame-ancestors": "'none'",
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v}`);
  // Chỉ production: local dùng MinIO http://localhost:9000, nâng lên https sẽ hỏng upload.
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function securityHeaders(env: Record<string, string | undefined> = process.env): HeaderKV[] {
  const headers: HeaderKV[] = [
    { key: "Content-Security-Policy", value: buildCsp(env) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    // Quay video trong app (MediaRecorder) cần camera + micro; vị trí cho "gần bạn".
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  if (env.NODE_ENV === "production") {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
