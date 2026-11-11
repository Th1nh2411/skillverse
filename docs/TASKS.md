# Danh sách việc chung

Đồng đội tự nhận việc: đổi `[ ]` → `[~] (tên)` khi bắt đầu, `[x]` khi xong. Chỉ sửa dòng của mình.
Vùng sở hữu: domain → packages/domain, packages/validation · api → packages/api, apps/web/app/api, apps/web/auth*, apps/web/lib/server, .github · ui → apps/web/app (trừ app/api), apps/web/components, apps/web/lib (trừ lib/server) · qa → apps/web/e2e, apps/web/playwright.config.ts, docs/QA.md
Lead sở hữu: packages/db, file cấu hình gốc, docs/PROGRESS.md, docs/DECISIONS.md, docs/DEPLOY.md.

(Các giai đoạn được lead thêm vào bên dưới.)

## Giai đoạn 1 — Hồ sơ và kỹ năng
Màn: Onboarding, Hồ sơ (Main.html), Cây kỹ năng, Chi tiết kỹ năng, Khám phá; độ hiếm từ holder_count.

### domain
- [x] (domain) D1.1 Hạ tầng test: helper DB test (`skillverse_test`), reset + fixture builder (user, skill có levels/criteria v1, edges)
- [x] (domain) D1.2 `rarityOf(holderCount, thresholds)` + `getRarityThresholds(db)`; `accountLevelForXp` / `xpProgress` theo `account_level_curve` (công thức trùng seed: XP từ L→L+1 = step·L) + test
- [x] (domain) D1.3 Truy vấn kỹ năng: `getSkillTree(db, {userId, categorySlug})` (trạng thái nút achieved/practicing/locked theo skill_edges + user_skills, yêu cầu cấp kế tiếp), `getSkillDetail(db, {slug, userId})` (5 cấp + tiêu chí phiên bản hiện tại, số đang luyện, số đạt cấp ≥ 4, rủi ro, đề xuất sửa tiêu chí đang mở kèm tỉ lệ có trọng số) + test
- [x] (domain) D1.4 Khám phá: `searchSkills`, `rarestSkills`, `trendingSkills` (tăng trưởng proofs/posts 7 ngày so với 7 ngày trước), `nearbyPeople` (cùng home_cell, chỉ share_location=true; không lộ vị trí) + test
- [x] (domain) D1.5 Hồ sơ: `getProfile(db, {handle | userId, viewerId})` (cấp tổng, XP tiến độ, thống kê: số kỹ năng, số huy hiệu hiếm, số thử thách; kỹ năng nổi bật kèm độ hiếm + số người đã xác thực + trạng thái chờ duyệt) + test
- [x] (domain) D1.6 Onboarding: `getOnboardingOptions`, `completeOnboarding(db, {userId, skillIds (≥3), selfLevels (chỉ gợi ý, KHÔNG ghi level)})` → tạo user_skills level 0 (nếu chưa có), skill_follows, đặt onboarded_at, trả thử thách đầu tiên gợi ý; Zod schema tương ứng trong packages/validation + test
- [x] (domain) D1.7 (nếu còn thời gian) Bắt đầu lõi giai đoạn 2: `submitProof`, `assignReviewers`, `finalizeProof` + test (xem DATA_MODEL.md mục 3–5)

### api
- [x] (api) A1.1 Auth.js v5 (`next-auth@5 beta` đã cài): Google + email magic link (nodemailer; EMAIL_SERVER trống → in link ra console), adapter tự viết trên model User/AuthAccount/AuthSession/AuthVerificationToken, session strategy database. Tạo handle tự động khi tạo user.
- [x] (api) A1.2 Đăng nhập dev (chỉ khi `AUTH_DEV_LOGIN=true`): POST nhận handle seed → tạo auth_sessions + cookie. Context tRPC phân giải user từ cookie HOẶC `Authorization: Bearer <session_token>`.
- [x] (api) A1.3 Middleware/proxy: chưa đăng nhập → `/login`; đăng nhập nhưng chưa onboarding → `/onboarding`. Server caller cho RSC: `apps/web/lib/server/trpc.ts`.
- [x] (api) A1.4 Router giai đoạn 1 (gọi packages/domain, input Zod từ packages/validation): `skill.tree`, `skill.detail`, `skill.search`, `discover.home` (hiếm nhất, thịnh hành, gần bạn, danh mục), `profile.me`, `profile.byHandle`, `onboarding.options`, `onboarding.complete`, `me`.
- [x] (api) A1.5 Test Vitest cho router (createCaller) với DB `skillverse_test`: quyền (chưa đăng nhập bị chặn), validate input.
- [x] (api) A1.6 Gửi cho ui danh sách procedure + kiểu (`inferRouterOutputs<AppRouter>`) qua hộp thư.

### ui
- [x] (ui) U1.1 Đọc SKILL.md skillverse-ui + skill frontend-design. Tinh chỉnh token (rừng đêm, WCAG AA), thành phần nền: Button, IconButton (aria-label), InfoSheet (ⓘ → bottom sheet), **LevelPatch** (huy hiệu vải thêu, hình theo danh mục, chỉ thêu theo độ hiếm), ProgressBar, Avatar chữ cái, EmptyState.
- [x] (ui) U1.2 Màn Đăng nhập (`/login`: Google + email magic link + đăng nhập dev khi bật) và Onboarding (`/onboarding`)
- [x] (ui) U1.3 Hồ sơ của tôi (`/profile`, Main.html)
- [x] (ui) U1.4 Cây kỹ năng (`/skills/tree/[category]`) — đường mòn bản đồ
- [x] (ui) U1.5 Chi tiết kỹ năng (`/skills/[slug]`)
- [x] (ui) U1.6 Khám phá (`/discover`). Mỗi màn: chụp Playwright 360/390px, so mockup, tự soi theo "Những thứ cần sửa" + "Ít chữ". Ảnh lưu `apps/web/screenshots/` (không commit thư mục này nếu nặng).

### qa
- [x] (qa) Q1.1 Cài Playwright chromium; `apps/web/playwright.config.ts` (webServer cổng 3200, `NEXT_DIST_DIR=.next-e2e`, DATABASE_URL=skillverse_e2e, globalSetup reset+seed DB e2e qua `SEED_RESET=1`)
- [x] (qa) Q1.2 Helper đăng nhập dev bằng handle (theo API của api; trước khi có thì viết sẵn, skip có điều kiện)
- [x] (qa) Q1.3 E2E giai đoạn 1: onboarding người mới (chọn 3 kỹ năng → hồ sơ), xem hồ sơ, cây kỹ năng, chi tiết kỹ năng, khám phá/tìm kiếm
- [x] (qa) Q1.4 Rà soát code theo QUY TẮC BẮT BUỘC + DATA_MODEL.md (grep ghi level ngoài finalizeProof, UPDATE criteria, ngưỡng hard-code, Prisma trong component, emoji, thiếu aria-label, dữ liệu cá nhân trên URL). Báo lỗi vào hộp thư chủ sở hữu; tổng hợp vào `docs/QA.md`.
- [x] (qa) Q1.5 Kiểm tra a11y cơ bản (axe nếu cài được, hoặc kiểm tra thủ công vùng chạm/aria) các màn giai đoạn 1
