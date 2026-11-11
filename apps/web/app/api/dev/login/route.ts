/**
 * Đăng nhập dev bằng handle seed — CHỈ khi AUTH_DEV_LOGIN=true (không bao giờ trên production).
 * POST (không đặt handle lên URL):
 *   - JSON `{ "handle": "minhhoang" }` → 200 `{ ok, user, sessionToken, expires }` + Set-Cookie
 *   - form `handle=...&next=/profile` → 303 về `next` (đường dẫn nội bộ) + Set-Cookie
 */
import { NextResponse, type NextRequest } from "next/server";
import { devLogin, devLoginEnabled, SECURE_SESSION_COOKIE, SESSION_COOKIE } from "@skillverse/api";
import { getPrisma } from "@skillverse/db";
import { handle as handleSchema } from "@skillverse/validation";

function safeNext(v: unknown): string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}

export async function POST(req: NextRequest) {
  if (!devLoginEnabled()) return new NextResponse(null, { status: 404 });

  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  let rawHandle: unknown;
  let next: string;
  try {
    if (isJson) {
      const body = (await req.json()) as { handle?: unknown; next?: unknown };
      rawHandle = body.handle;
      next = safeNext(body.next);
    } else {
      const form = await req.formData();
      rawHandle = form.get("handle");
      next = safeNext(form.get("next"));
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const parsed = handleSchema.safeParse(typeof rawHandle === "string" ? rawHandle.trim().toLowerCase() : rawHandle);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Tên người dùng không hợp lệ." }, { status: 400 });

  const result = await devLogin(getPrisma(), parsed.data);
  if (!result) return NextResponse.json({ ok: false, error: "Không tìm thấy người dùng." }, { status: 404 });

  const secure = req.nextUrl.protocol === "https:";
  const res = isJson
    ? NextResponse.json({
        ok: true,
        user: { handle: result.user.handle, onboarded: result.user.onboarded },
        sessionToken: result.sessionToken,
        expires: result.expires.toISOString(),
      })
    : NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: result.expires,
  });
  return res;
}
