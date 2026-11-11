import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDb, fx, getTestDb, resetDb } from "@skillverse/domain/testing";
import {
  createAuthAdapter,
  createSessionFor,
  devLogin,
  getSessionUser,
  handleBase,
  sessionTokenFromHeaders,
} from "../src";

const db = getTestDb();
const adapter = createAuthAdapter(db);

beforeAll(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await closeTestDb();
});

describe("handleBase", () => {
  it("bỏ dấu tiếng Việt, ký tự lạ, đủ dài", () => {
    expect(handleBase("Nguyễn Đức Anh")).toBe("nguyen_duc_anh");
    expect(handleBase("minh.hoang+x@gmail.com")).toBe("minh_hoang_x");
    expect(handleBase("ab@x.com")).toMatch(/^[a-z0-9_]{3,30}$/);
    expect(handleBase("a".repeat(60))).toHaveLength(25);
  });
});

describe("adapter Auth.js", () => {
  it("createUser map name/image → displayName/avatarUrl, tự sinh handle không trùng", async () => {
    const u1 = await adapter.createUser!({
      id: "ignored",
      email: "Lan.Phuong@Example.com",
      emailVerified: null,
      name: "Lan Phương",
      image: "https://img.example/a.png",
    });
    expect(u1).toMatchObject({ email: "lan.phuong@example.com", name: "Lan Phương", image: "https://img.example/a.png" });
    const row = await db.user.findUniqueOrThrow({ where: { id: u1.id } });
    expect(row).toMatchObject({ handle: "lan_phuong", displayName: "Lan Phương", avatarUrl: "https://img.example/a.png" });
    expect(row.onboardedAt).toBeNull();

    const u2 = await adapter.createUser!({ id: "x", email: "khac@example.com", emailVerified: new Date(), name: "Lan Phương" });
    const row2 = await db.user.findUniqueOrThrow({ where: { id: u2.id } });
    expect(row2.handle).toMatch(/^lan_phuong_\d{4}$/);
    expect(row2.emailVerified).toBeInstanceOf(Date);

    // Magic link không có name → handle + tên lấy từ email
    const u3 = await adapter.createUser!({ id: "y", email: "thu.ha@example.com", emailVerified: new Date() });
    expect(u3.name).toBe("thu.ha");
    expect((await db.user.findUniqueOrThrow({ where: { id: u3.id } })).handle).toBe("thu_ha");
  });

  it("linkAccount / getUserByAccount / updateUser", async () => {
    const u = await adapter.createUser!({ id: "", email: "g@example.com", emailVerified: null, name: "G" });
    await adapter.linkAccount!({
      userId: u.id,
      type: "oidc",
      provider: "google",
      providerAccountId: "123",
      access_token: "at",
      expires_at: 1700000000,
      token_type: "bearer",
    });
    expect((await adapter.getUserByAccount!({ provider: "google", providerAccountId: "123" }))?.id).toBe(u.id);
    const upd = await adapter.updateUser!({ id: u.id, name: "Gia Bảo", emailVerified: new Date() });
    expect(upd.name).toBe("Gia Bảo");
    expect((await adapter.getUserByEmail!("G@example.com"))?.id).toBe(u.id);
  });

  it("session: tạo, đọc, người bị khóa không có phiên, xóa", async () => {
    const u = await fx.user(db);
    const expires = new Date(Date.now() + 3600_000);
    await adapter.createSession!({ sessionToken: "tok-1", userId: u.id, expires });
    expect((await adapter.getSessionAndUser!("tok-1"))?.user.id).toBe(u.id);

    await db.user.update({ where: { id: u.id }, data: { status: "banned" } });
    expect(await adapter.getSessionAndUser!("tok-1")).toBeNull();
    expect(await getSessionUser(db, "tok-1")).toBeNull();

    await adapter.deleteSession!("tok-1");
    expect(await db.authSession.count({ where: { sessionToken: "tok-1" } })).toBe(0);
  });

  it("verification token chỉ dùng được một lần", async () => {
    const t = { identifier: "a@example.com", token: "hashed", expires: new Date(Date.now() + 60_000) };
    await adapter.createVerificationToken!(t);
    expect(await adapter.useVerificationToken!({ identifier: t.identifier, token: t.token })).toMatchObject(t);
    expect(await adapter.useVerificationToken!({ identifier: t.identifier, token: t.token })).toBeNull();
  });
});

describe("phân giải phiên (cookie | Bearer)", () => {
  it("đọc token từ Bearer hoặc cookie Auth.js", () => {
    expect(sessionTokenFromHeaders(new Headers({ authorization: "Bearer abc" }))).toBe("abc");
    expect(sessionTokenFromHeaders(new Headers({ cookie: "x=1; authjs.session-token=def" }))).toBe("def");
    expect(sessionTokenFromHeaders(new Headers({ cookie: "__Secure-authjs.session-token=ghi" }))).toBe("ghi");
    expect(sessionTokenFromHeaders(new Headers())).toBeNull();
  });

  it("phiên hết hạn → null; phiên còn hạn → SessionUser không có email", async () => {
    const u = await fx.user(db, { onboarded: false, isEditor: true });
    const live = await createSessionFor(db, u.id);
    const viewer = await getSessionUser(db, live.sessionToken);
    expect(viewer).toMatchObject({ id: u.id, handle: u.handle, onboarded: false, isEditor: true });
    expect(viewer).not.toHaveProperty("email");

    await db.authSession.create({ data: { sessionToken: "expired", userId: u.id, expires: new Date(Date.now() - 1000) } });
    expect(await getSessionUser(db, "expired")).toBeNull();
    expect(await getSessionUser(db, "khong-ton-tai")).toBeNull();
  });

  it("đăng nhập dev chỉ chạy khi AUTH_DEV_LOGIN=true và không phải production Vercel", async () => {
    const u = await fx.user(db, { handle: "devlogin_user" });
    expect(await devLogin(db, u.handle, { AUTH_DEV_LOGIN: "false" } as NodeJS.ProcessEnv)).toBeNull();
    expect(await devLogin(db, u.handle, { AUTH_DEV_LOGIN: "true", VERCEL_ENV: "production" } as NodeJS.ProcessEnv)).toBeNull();
    expect(await devLogin(db, "khong_co_ai", { AUTH_DEV_LOGIN: "true" } as NodeJS.ProcessEnv)).toBeNull();
    const ok = await devLogin(db, u.handle, { AUTH_DEV_LOGIN: "true" } as NodeJS.ProcessEnv);
    expect(ok?.user.id).toBe(u.id);
    expect((await getSessionUser(db, ok!.sessionToken))?.id).toBe(u.id);
  });
});
