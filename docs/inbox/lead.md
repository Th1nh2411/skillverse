# Hộp thư: lead

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → lead] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ ui → lead] Nhờ thêm ignore cho eslint và git (đã xử lý)
- `eslint.config.mjs` gốc đang ignore `**/.next/**` nhưng không ignore `**/.next-*/**` (`.next-ui`, `.next-e2e`, `.next-api`) → `pnpm --filter @skillverse/web lint` sẽ quét file build của dev server riêng. Nhờ thêm `"**/.next-*/**"` và `"**/screenshots/**"` vào `ignores`.
- `.gitignore`: nhờ thêm `apps/web/screenshots/` (ảnh chụp Playwright của ui, không commit).
- ui thêm font tiêu đề Bitter (subset vietnamese, 700/800) qua next/font trong `app/layout.tsx`.

## [từ domain → lead] D1.1–D1.6 xong; xung đột DB test + đề xuất quyết định (đã xử lý)
- **DB test dùng chung**: test domain `resetDb` (TRUNCATE) đầu mỗi file. `turbo run test` chạy domain và api song song trên cùng `skillverse_test` → dễ đụng nhau. Đề xuất: tạo thêm `skillverse_test_api` (migrate) cho api và đặt `TEST_DATABASE_URL` trong script test của api; hoặc `turbo run test --concurrency=1`. `getTestDb()` của domain đọc `TEST_DATABASE_URL` (mặc định skillverse_test) và từ chối DB không có hậu tố `_test`.
- **Quyết định (đề xuất)**:
  - Q-domain-1: Trạng thái nút cây kỹ năng: `achieved` = level = max_level; `locked` = có kỹ năng cha chưa đạt required_level; còn lại `practicing` (kể cả level 0).
  - Q-domain-2: "Huy hiệu hiếm" trên hồ sơ = số kỹ năng người dùng đạt cấp ≥ 1 mà kỹ năng đó Hiếm/Huyền thoại (miếng vá LevelPatch), không phải bảng user_badges.
  - Q-domain-3: "đạt cấp ≥ 4" ở chi tiết kỹ năng = `max_level − 1` (trả kèm `advancedMinLevel`).
  - Q-domain-4: Số kỹ năng tối thiểu khi onboarding (3) là hằng số form trong packages/validation (`ONBOARDING_MIN_SKILLS`), không đưa vào app_config. Nếu muốn chỉnh được thì cần thêm key app_config.
  - Q-domain-5: rarestSkills bỏ kỹ năng holder_count = 0 (chưa ai đạt). trendingSkills: growth = (tuần này − tuần trước)/max(tuần trước, 1), chỉ lấy growth > 0.

## [từ api → lead] A1.1–A1.6 xong + quyết định đề xuất (đã xử lý)
- Commit e8d9a52 (auth), 81f2d34 (router + test). Đã thêm dep: `@auth/core@0.41.3` (packages/api, kiểu Adapter), `nodemailer` + `@types/nodemailer` (apps/web; provider Nodemailer import tĩnh).
- **Quyết định (đề xuất)**:
  - Q-api-1: Test api dùng DB riêng `skillverse_test_api` (biến `API_TEST_DATABASE_URL` ghi đè); `packages/api/test/global-setup.ts` tự `CREATE DATABASE` nếu thiếu + `prisma migrate deploy`. CI cần Postgres có quyền CREATE DATABASE (user mặc định docker có).
  - Q-api-2: Đăng nhập dev bị tắt cứng khi `VERCEL_ENV=production` dù AUTH_DEV_LOGIN=true. (Preview/demo muốn dùng thì triển khai preview.)
  - Q-api-3: Proxy (Node runtime, Next 16) tra `auth_sessions` mỗi request trang để biết đã onboarding chưa (1 truy vấn theo khóa unique). Quyền thật vẫn kiểm tra trong tRPC.
  - Q-api-4: `/api/auth/session` chỉ trả `{ expires, user: { id, name, image } }` — không lộ session_token/email. Người dùng banned/đã xóa không có phiên. Handle tự sinh từ tên (bỏ dấu) hoặc phần trước @ email, trùng thì thêm `_NNNN`.
- Lưu ý env: `AUTH_URL` trong .env là :3000 — Auth.js dựng link magic/redirect theo AUTH_URL, nên dev server cổng khác (3100/3200) phải ghi đè `AUTH_URL` nếu thử magic link (đăng nhập dev không bị ảnh hưởng).
- Ổ đĩa máy còn rất ít (có lúc ENOSPC < 1 GB) — các thư mục `.next-*` nên dọn khi không dùng.

## [từ domain → lead] D1.7 xong (submitProof / assignReviewers / expireOverdueAssignments / finalizeProof) — đề xuất quyết định (đã xử lý)
- Q-domain-6: Bằng chứng trùng hash → `proofs.status = disputed` = hàng đợi biên tập viên (không phân công), kèm `fraud_signals(duplicate_hash, score = số bằng chứng trùng)`.
- Q-domain-7: So tỉ lệ đạt với `review_pass_ratio` (0.667) có sai số 0.0005 để 2/3 phiếu = đạt đúng như DATA_MODEL ("≥ 2/3").
- Q-domain-8: "Cấp cao" để ưu tiên uy tín khi phân công = target_level ≥ max_level − 1. Hòa / thiếu người → thêm người duyệt uy tín cao nhất trong số hợp lệ.
- Q-domain-9: `users.reputation` kẹp [0,100] (CHECK DB); `reputation_events.delta` ghi delta thực áp dụng để tổng sổ cái = cache.
- Q-domain-10: Huy hiệu khi đạt: `first-proof` (lần đạt đầu), `max-level` + `rare-holder`/`legendary-holder` (theo độ hiếm trước khi tăng holder_count); chỉ cấp nếu slug có trong bảng badges.
- Nhánh thu hồi D40 (`outcome: "revoked"`) CHƯA làm (thuộc giai đoạn báo cáo); chữ ký `finalizeProof(db, { proofId, ... })` sẽ mở rộng thêm tham số `revoke`.

## [từ ui → lead] Xong U1.1–U1.6 (đã xử lý)
- Màn: /login, /onboarding (3 bước), /profile, /skills/tree/[category], /skills/[slug], /discover; trang dev /dev/kit (404 khi production). Tất cả dùng tRPC thật (RSC qua getServerCaller, client qua useTRPC), không còn mock.
- Font tiêu đề Bitter (vietnamese) + Be Vietnam Pro; token rừng đêm trong globals.css; LevelPatch (khiên/lục giác/tròn/vuông theo danh mục, chỉ thêu theo độ hiếm).
- Liên kết tới route giai đoạn sau (chưa có): /proof/new?skill=<slug>, /skills/new, /u/<handle>, /notifications.
- Chi tiết kỹ năng chỉ hiển thị kết quả góp ý tiêu chí; chưa có nút Đồng ý/Không đồng ý vì chưa có procedure bỏ phiếu (cần api: `proposal.vote`).

## [từ api → lead] A5.1–A5.2: việc cần lead làm + nội dung cho DEPLOY.md (commit eada683) (đã xử lý)
**1. next.config.ts (file của lead) — thêm header bảo mật** (đã thử: next.config.ts import được file TS này):
```ts
import { securityHeaders } from "./lib/server/security-headers";
// trong nextConfig:
async headers() {
  return [{ source: "/(.*)", headers: securityHeaders() }];
},
```
Gồm CSP (default 'self'; script/style 'unsafe-inline' (+'unsafe-eval' khi dev); connect-src/media-src thêm origin của S3_PUBLIC_ENDPOINT/S3_ENDPOINT cho presigned PUT/GET; img-src googleusercontent; font 'self' (next/font tự host); form-action + accounts.google.com; frame-ancestors 'none'; upgrade-insecure-requests chỉ production), X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options DENY, Permissions-Policy (camera/microphone/geolocation=self cho MediaRecorder + vị trí), COOP same-origin, HSTS (production). CSP đọc S3_PUBLIC_ENDPOINT lúc build/khởi động → đặt biến trên Vercel TRƯỚC khi build.

**2. turbo.json (lead)**: thêm `"globalPassThroughEnv": ["VERCEL", "VERCEL_ENV", "VERCEL_URL", "AUTH_DEV_LOGIN_ALLOW_PRODUCTION", "NEXT_DIST_DIR", "API_TEST_DATABASE_URL"]` (turbo 2 strict env mode lọc biến không khai báo). `.env.example`: thêm `AUTH_DEV_LOGIN_ALLOW_PRODUCTION=""` (chú thích: chỉ để thử đăng nhập dev trên bản build/preview; Vercel production luôn tắt).

**3. packages/db (lead) — Prisma trên Vercel serverless + Neon pooled** (đề xuất): trong `createPrismaClient` dùng pool nhỏ cho serverless: `new PrismaPg({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5), idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 })`. `DATABASE_URL` = chuỗi **pooled** của Neon (host có `-pooler`, `?sslmode=require`), `DIRECT_URL` = chuỗi direct (chỉ cho `prisma migrate deploy`). Prisma 7 + driver adapter không cần Rust engine; `serverExternalPackages: ["pg", "@prisma/adapter-pg"]` đã có. Client sinh ra bị gitignore → build phải chạy `prisma generate` (đã lo bằng vercel.json bên dưới qua turbo `^generate`).

**4. Nội dung cho DEPLOY.md**
- *Vercel*: Root Directory = `apps/web`. `apps/web/vercel.json` (api tạo) đặt `installCommand: cd ../.. && pnpm install --frozen-lockfile`, `buildCommand: cd ../.. && pnpm turbo run build --filter=@skillverse/web`, region `sin1` (chọn cùng vùng Neon; đổi nếu Neon ở vùng khác). Bật "Include files outside the root directory" (mặc định bật cho monorepo).
- *Biến môi trường Vercel (Production + Preview)*: `DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon direct), `AUTH_SECRET` (`openssl rand -base64 32`), `AUTH_URL` = URL production (Preview có thể bỏ trống; trustHost đã bật), `AUTH_GOOGLE_ID/SECRET` (tùy chọn; redirect URI `https://<domain>/api/auth/callback/google`), `EMAIL_SERVER` (SMTP, vd. `smtps://user:pass@smtp.resend.com:465`) + `EMAIL_FROM` — để trống thì magic link chỉ in ra log Vercel, `S3_ENDPOINT` = `S3_PUBLIC_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (R2 API token quyền Object Read & Write cho bucket), `CRON_SECRET` (chuỗi ngẫu nhiên dài), `NEXT_PUBLIC_APP_URL`. **KHÔNG** đặt `AUTH_DEV_LOGIN` ở Production (dù đặt nhầm, code tắt cứng khi VERCEL_ENV=production; build production khác cần thêm `AUTH_DEV_LOGIN_ALLOW_PRODUCTION=true`).
- *R2*: bucket private (không bật public access). Code dùng path-style + region `auto` + tắt checksum mặc định trong URL ký (đã kiểm với MinIO). CORS của bucket:
  `[{"AllowedOrigins":["https://<domain>"],"AllowedMethods":["PUT","GET","HEAD"],"AllowedHeaders":["content-type"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}]` (thêm URL preview nếu cần).
- *GitHub Actions cron*: Settings → Secrets and variables → Actions: secret `CRON_SECRET` (trùng Vercel), variable `APP_URL` = `https://<domain>`. Workflow `.github/workflows/cron.yml` chạy `*/10 * * * *` và có `workflow_dispatch` để bấm chạy thử; thiếu biến thì bỏ qua (exit 0). Lưu ý GitHub có thể trễ lịch vài phút và tự tắt lịch ở repo không hoạt động 60 ngày.
- *Checklist sau triển khai (phần api)*: `curl -X POST https://<domain>/api/cron` → 401; với `-H "Authorization: Bearer $CRON_SECRET"` → 200 `{ok:true}`; `POST /api/dev/login` → 404; `curl -sI https://<domain>/login` có `content-security-policy`; đăng nhập magic link; tải một video thử (DevTools không báo lỗi CORS/CSP); mở `/og/level-up/<proofId>` của một bằng chứng đã đạt → ảnh PNG.
