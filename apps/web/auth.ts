/**
 * Auth.js v5: Google + email magic link, adapter tự viết (packages/api), session strategy "database".
 * Cookie phiên chứa nguyên auth_sessions.session_token; app di động dùng cùng token làm Bearer.
 */
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { createAuthAdapter, SESSION_MAX_AGE_SECONDS } from "@skillverse/api";
import { getPrisma } from "@skillverse/db";
import { sendMagicLink } from "@/lib/server/email";

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ allowDangerousEmailAccountLinking: false }));
}

providers.push(
  Nodemailer({
    // Khi EMAIL_SERVER trống, sendMagicLink in link ra console nên server ở đây chỉ là giá trị giữ chỗ.
    server: process.env.EMAIL_SERVER || "smtp://localhost:25",
    from: process.env.EMAIL_FROM || "SkillVerse <no-reply@example.com>",
    sendVerificationRequest: ({ identifier, url, provider }) =>
      sendMagicLink({ identifier, url, from: provider.from }),
  }),
);

/** Có bật đăng nhập Google không (UI dùng để ẩn/hiện nút). */
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAuthAdapter(getPrisma()),
  providers,
  session: { strategy: "database", maxAge: SESSION_MAX_AGE_SECONDS },
  trustHost: true,
  pages: {
    signIn: "/login",
    // Auth.js nối thêm "?provider=nodemailer&type=email" → /login hiện trạng thái "kiểm tra email".
    verifyRequest: "/login",
    // Auth.js nối thêm "?error=<Mã>".
    error: "/login",
  },
  callbacks: {
    // /api/auth/session chỉ trả tối thiểu: KHÔNG lộ session_token (cookie httpOnly) hay email.
    session({ session, user }) {
      return {
        expires: session.expires,
        user: { id: user.id, name: user.name, image: user.image },
      } as unknown as typeof session;
    },
  },
});
