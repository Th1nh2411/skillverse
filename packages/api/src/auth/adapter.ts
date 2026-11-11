/**
 * Adapter Auth.js tự viết trên các model Prisma của SkillVerse:
 * User (displayName, avatarUrl, emailVerified), AuthAccount, AuthSession, AuthVerificationToken.
 * Session strategy = "database": cookie chứa nguyên `session_token`, cùng token đó dùng làm
 * `Authorization: Bearer` cho app di động (xem ./session.ts).
 */
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser } from "@auth/core/adapters";
import { Prisma, type PrismaClient, type User } from "@skillverse/db";
import { generateUniqueHandle } from "./handle";

function toAdapterUser(u: Pick<User, "id" | "email" | "emailVerified" | "displayName" | "avatarUrl">): AdapterUser {
  return { id: u.id, email: u.email, emailVerified: u.emailVerified, name: u.displayName, image: u.avatarUrl };
}

/** Người dùng bị khóa / đã xóa không được có phiên. */
function isBlocked(u: Pick<User, "status" | "deletedAt">): boolean {
  return u.status === "banned" || u.deletedAt !== null;
}

function str(v: unknown): string | null {
  return v === undefined || v === null ? null : String(v);
}

export function createAuthAdapter(db: PrismaClient): Adapter {
  return {
    async createUser(data) {
      const email = data.email.trim().toLowerCase();
      const displayName = data.name?.trim() || email.split("@")[0]!;
      for (let attempt = 0; ; attempt++) {
        const handle = await generateUniqueHandle(db, data.name?.trim() || email);
        try {
          const u = await db.user.create({
            data: { email, handle, displayName, avatarUrl: data.image ?? null, emailVerified: data.emailVerified ?? null },
          });
          return toAdapterUser(u);
        } catch (e) {
          // Hai người cùng lúc lấy một handle → thử lại với hậu tố khác.
          const target = e instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(e.meta ?? {}) : "";
          if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && target.includes("handle")) continue;
          throw e;
        }
      }
    },

    async getUser(id) {
      const u = await db.user.findUnique({ where: { id } });
      return u ? toAdapterUser(u) : null;
    },

    async getUserByEmail(email) {
      const u = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      return u ? toAdapterUser(u) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const acc = await db.authAccount.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return acc ? toAdapterUser(acc.user) : null;
    },

    async updateUser({ id, name, image, emailVerified, email }) {
      const u = await db.user.update({
        where: { id },
        data: {
          ...(name ? { displayName: name } : {}),
          ...(image !== undefined ? { avatarUrl: image } : {}),
          ...(emailVerified !== undefined ? { emailVerified } : {}),
          ...(email ? { email: email.trim().toLowerCase() } : {}),
        },
      });
      return toAdapterUser(u);
    },

    async deleteUser(id) {
      // Xóa mềm: không xóa bản ghi người dùng (DATA_MODEL mục 1.5); thu hồi mọi phiên.
      await db.$transaction([
        db.authSession.deleteMany({ where: { userId: id } }),
        db.user.update({ where: { id }, data: { deletedAt: new Date() } }),
      ]);
    },

    async linkAccount(a: AdapterAccount) {
      await db.authAccount.create({
        data: {
          userId: a.userId,
          type: a.type,
          provider: a.provider,
          providerAccountId: a.providerAccountId,
          refreshToken: str(a.refresh_token),
          accessToken: str(a.access_token),
          expiresAt: typeof a.expires_at === "number" ? a.expires_at : null,
          tokenType: str(a.token_type),
          scope: str(a.scope),
          idToken: str(a.id_token),
          sessionState: str(a.session_state),
        },
      });
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await db.authAccount.deleteMany({ where: { provider, providerAccountId } });
    },

    async createSession(s) {
      const row = await db.authSession.create({ data: { sessionToken: s.sessionToken, userId: s.userId, expires: s.expires } });
      return { sessionToken: row.sessionToken, userId: row.userId, expires: row.expires };
    },

    async getSessionAndUser(sessionToken) {
      const row = await db.authSession.findUnique({ where: { sessionToken }, include: { user: true } });
      if (!row || isBlocked(row.user)) return null;
      const session: AdapterSession = { sessionToken: row.sessionToken, userId: row.userId, expires: row.expires };
      return { session, user: toAdapterUser(row.user) };
    },

    async updateSession({ sessionToken, expires }) {
      if (!expires) return null;
      const res = await db.authSession.updateMany({ where: { sessionToken }, data: { expires } });
      if (res.count === 0) return null;
      const row = await db.authSession.findUnique({ where: { sessionToken } });
      return row ? { sessionToken: row.sessionToken, userId: row.userId, expires: row.expires } : null;
    },

    async deleteSession(sessionToken) {
      await db.authSession.deleteMany({ where: { sessionToken } });
    },

    async createVerificationToken(t) {
      await db.authVerificationToken.create({ data: { identifier: t.identifier, token: t.token, expires: t.expires } });
      return t;
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const t = await db.authVerificationToken.delete({ where: { identifier_token: { identifier, token } } });
        return { identifier: t.identifier, token: t.token, expires: t.expires };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return null;
        throw e;
      }
    },
  };
}
