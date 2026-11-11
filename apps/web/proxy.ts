/**
 * Proxy (Next 16, Node runtime): kiểm tra lạc quan để điều hướng.
 *  - Chưa đăng nhập → /login
 *  - Đã đăng nhập nhưng chưa onboarding → /onboarding
 *  - Đã đăng nhập mà vào /login → về trang chính
 * Quyền thật vẫn kiểm tra ở server (tRPC protectedProcedure).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, sessionTokenFromCookies } from "@skillverse/api";
import { getPrisma } from "@skillverse/db";

/** Chỉ dành cho người CHƯA đăng nhập (đã đăng nhập thì về trang chính). */
const PUBLIC_PREFIXES = ["/login"];
/** Mở cho mọi người, có hay không có phiên (trang chia sẻ thành tích). */
const OPEN_PREFIXES = ["/share"];

function matches(prefixes: string[], pathname: string): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
const isPublic = (pathname: string) => matches(PUBLIC_PREFIXES, pathname);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (matches(OPEN_PREFIXES, pathname)) return NextResponse.next();
  const token = sessionTokenFromCookies((name) => req.cookies.get(name)?.value);
  const user = token ? await getSessionUser(getPrisma(), token) : null;

  if (!user) {
    if (isPublic(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!user.onboarded) {
    if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return NextResponse.next();
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }
  if (isPublic(pathname) || pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Bỏ qua API (tự kiểm tra quyền), ảnh chia sẻ /og, file tĩnh và tài nguyên PWA.
  matcher: ["/((?!api/|og/|og$|_next/|favicon\\.ico|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|sw\\.js|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|woff2?)$).*)"],
};
