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

## Giai đoạn 2 — Vòng lặp xác thực (quan trọng nhất)
Màn: Đăng bằng chứng (Proof.html), Duyệt (Review.html), Lên cấp (LevelUp.html) + thẻ chia sẻ. Playwright: nộp → 3 người duyệt → lên cấp.

### domain
- [ ] D2.1 (phần lớn đã có từ D1.7 — bổ sung chỗ thiếu) `submitProof`: kiểm tra level == target−1, kỹ năng cha đạt required_level, safety_ack cho kỹ năng rủi ro, giới hạn media từ `app_config.media_limits`; lưu criteria_version_id hiện tại; hash SHA-256 (D20); trùng hash → `fraud_signals(duplicate_hash)` + trạng thái chờ biên tập (không phân công); `ai_precheck` giả lập chỉ tham khảo (thời lượng, định dạng) + test
- [ ] D2.2 (đã có từ D1.7 — bổ sung thông báo + test thiếu) `assignReviewers` (DATA_MODEL mục 4: cấp tối thiểu, review_ban, uy tín ≥ ngưỡng; loại follow 2 chiều, skill_swaps, trùng device fingerprint, đã gặp trong `reviewer_exclusion_days`; ngẫu nhiên, ưu tiên uy tín cao cho cấp cao; hạn `review_due_hours`) + thông báo review_assigned + test
- [ ] D2.3 `submitReview` (chỉ người được phân công, state assigned, đủ mark cho mọi tiêu chí của đúng criteria_version, verdict nhất quán) + XP review_done + tiến độ daily quest review_2 → khi đủ phiếu gọi `finalizeProof`
- [ ] D2.4 (đã có từ D1.7 — kiểm tra đủ yêu cầu) `finalizeProof` trong MỘT `$transaction`: tỉ lệ ≥ `review_pass_ratio` → đạt (level, xp_ledger, user_skills.xp, total_xp/account_level cache, holder_count khi đạt max_level, huy hiệu, post level_up, notification); trượt → notification; hòa/thiếu → thêm 1 người duyệt uy tín cao; uy tín người duyệt (vote_matched/mismatched) + test (hòa, quá hạn, trùng hash, idempotent khi gọi 2 lần)
- [ ] D2.5 `reassignExpiredReviews` (state expired → gán người khác) cho JobRunner; `fileAppeal` (1 lần/bằng chứng, trong `appeal_window_days`) + `resolveAppeal` (biên tập viên; overturned → mở lại vòng duyệt mới với người duyệt khác, KHÔNG ghi level trực tiếp) + `reportProofDuringReview` (tạo reports, reason enum) + test
- [ ] D2.6 Truy vấn: `getReviewQueue(reviewerId)`, `getReviewTask(assignmentId, reviewerId)` (ẩn danh người nộp: không trả user id/handle/tên), `getProofStatus`, `getLevelUpSummary(proofId, userId)`, `getShareCard(proofId)` (dữ liệu công khai cho thẻ chia sẻ) + Zod

### api
- [ ] A2.1 Upload: `proof.createUpload` (presigned PUT tới S3/R2, key ngẫu nhiên không chứa dữ liệu cá nhân, giới hạn content-type/size từ app_config) ; sau upload server đọc object tính SHA-256 (hoặc xác minh hash client) ; URL xem video = presigned GET có thời hạn, chỉ cho người nộp/người được phân công/biên tập/hoặc khi bằng chứng đã đạt
- [ ] A2.2 Router: `proof.submit`, `proof.status`, `proof.appeal`, `review.queue`, `review.task`, `review.submit`, `review.report`, `levelUp.summary`
- [ ] A2.3 `POST /api/cron` (header `Authorization: Bearer $CRON_SECRET` hoặc `x-cron-secret`; so sánh constant-time) chạy qua JobRunner: reassignExpiredReviews, closeExpiredProposals (stub nếu domain chưa có), weeklyReputationRecovery (chạy một lần/tuần, idempotent). `.github/workflows/cron.yml` mỗi 10 phút gọi endpoint bằng secret `CRON_SECRET` + biến `APP_URL`
- [ ] A2.4 Thẻ chia sẻ next/og: `app/og/level-up/[proofId]/route.tsx` (ảnh 1200x630, font Be Vietnam Pro có dấu tiếng Việt, huy hiệu vải thêu) + metadata OG cho trang công khai `/share/[proofId]` (ui làm trang, api làm ảnh)
- [ ] A2.5 Test router (quyền: người không được phân công không duyệt được, không xem được video; cron sai secret → 401)

### ui
- [ ] U2.1 Đăng bằng chứng (`/proof/new`): chọn kỹ năng/cấp, quay trong app bằng MediaRecorder 720p (ưu tiên) hoặc chọn file, giới hạn 60 MB / 3 phút, upload thẳng presigned, kết quả kiểm tra sơ bộ dạng biểu tượng, cam kết an toàn một lần, nút "Gửi xác thực"
- [ ] U2.2 Trạng thái bằng chứng của tôi (`/proofs/[id]`): tiến độ 0/3, kết quả từng tiêu chí khi trượt, nút "Kháng nghị"
- [ ] U2.3 Duyệt (`/review` hàng đợi + `/review/[assignmentId]`): ẩn danh (biểu tượng khiên + ⓘ), chấm từng tiêu chí Đạt/Chưa đạt, nhận xét, "Báo cáo" mở sheet lý do, uy tín kèm ⓘ
- [ ] U2.4 Lên cấp (`/level-up/[proofId]`): chuyển động "khâu" huy hiệu (tôn trọng prefers-reduced-motion), XP, huy hiệu, nút chia sẻ (Web Share API, fallback sao chép link)
- [ ] U2.5 Trang công khai `/share/[proofId]` (không cần đăng nhập, không lộ dữ liệu cá nhân ngoài tên hiển thị) dùng ảnh OG của api
- [ ] U2.6 Chụp màn hình + tự soi từng màn như giai đoạn 1

### qa
- [ ] Q2.1 E2E chính: người dùng nộp bằng chứng (file video mẫu nhỏ trong e2e/fixtures) → 3 người duyệt (đăng nhập dev từng người được phân công) chấm Đạt → người nộp thấy Lên cấp, level tăng
- [ ] Q2.2 E2E: trượt + kháng nghị; người duyệt không được phân công bị chặn; người duyệt không thấy tên người nộp
- [ ] Q2.3 E2E/HTTP: /api/cron sai secret → 401, đúng secret → 200
- [ ] Q2.4 Rà soát: finalizeProof là nơi duy nhất ghi level; mọi ngưỡng qua app_config; URL video là presigned có hạn; không lộ người nộp trong payload review
- [ ] Q2.5 Cập nhật docs/QA.md
