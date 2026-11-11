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
- [x] (domain) D2.1 (phần lớn đã có từ D1.7 — bổ sung chỗ thiếu) `submitProof`: kiểm tra level == target−1, kỹ năng cha đạt required_level, safety_ack cho kỹ năng rủi ro, giới hạn media từ `app_config.media_limits`; lưu criteria_version_id hiện tại; hash SHA-256 (D20); trùng hash → `fraud_signals(duplicate_hash)` + trạng thái chờ biên tập (không phân công); `ai_precheck` giả lập chỉ tham khảo (thời lượng, định dạng) + test
- [x] (domain) D2.2 (đã có từ D1.7 — bổ sung thông báo + test thiếu) `assignReviewers` (DATA_MODEL mục 4: cấp tối thiểu, review_ban, uy tín ≥ ngưỡng; loại follow 2 chiều, skill_swaps, trùng device fingerprint, đã gặp trong `reviewer_exclusion_days`; ngẫu nhiên, ưu tiên uy tín cao cho cấp cao; hạn `review_due_hours`) + thông báo review_assigned + test
- [x] (domain) D2.3 `submitReview` (chỉ người được phân công, state assigned, đủ mark cho mọi tiêu chí của đúng criteria_version, verdict nhất quán) + XP review_done + tiến độ daily quest review_2 → khi đủ phiếu gọi `finalizeProof`
- [x] (domain) D2.4 (đã có từ D1.7 — kiểm tra đủ yêu cầu) `finalizeProof` trong MỘT `$transaction`: tỉ lệ ≥ `review_pass_ratio` → đạt (level, xp_ledger, user_skills.xp, total_xp/account_level cache, holder_count khi đạt max_level, huy hiệu, post level_up, notification); trượt → notification; hòa/thiếu → thêm 1 người duyệt uy tín cao; uy tín người duyệt (vote_matched/mismatched) + test (hòa, quá hạn, trùng hash, idempotent khi gọi 2 lần)
- [x] (domain) D2.5 `reassignExpiredReviews` (state expired → gán người khác) cho JobRunner; `fileAppeal` (1 lần/bằng chứng, trong `appeal_window_days`) + `resolveAppeal` (biên tập viên; overturned → mở lại vòng duyệt mới với người duyệt khác, KHÔNG ghi level trực tiếp) + `reportProofDuringReview` (tạo reports, reason enum) + test
- [x] (domain) D2.6 Truy vấn: `getReviewQueue(reviewerId)`, `getReviewTask(assignmentId, reviewerId)` (ẩn danh người nộp: không trả user id/handle/tên), `getProofStatus`, `getLevelUpSummary(proofId, userId)`, `getShareCard(proofId)` (dữ liệu công khai cho thẻ chia sẻ) + Zod

### api
- [x] (api) A2.1 Upload: `proof.createUpload` (presigned PUT tới S3/R2, key ngẫu nhiên không chứa dữ liệu cá nhân, giới hạn content-type/size từ app_config) ; sau upload server đọc object tính SHA-256 (hoặc xác minh hash client) ; URL xem video = presigned GET có thời hạn, chỉ cho người nộp/người được phân công/biên tập/hoặc khi bằng chứng đã đạt
- [x] (api) A2.2 Router: `proof.submit`, `proof.status`, `proof.appeal`, `review.queue`, `review.task`, `review.submit`, `review.report`, `levelUp.summary`
- [x] (api) A2.3 `POST /api/cron` (header `Authorization: Bearer $CRON_SECRET` hoặc `x-cron-secret`; so sánh constant-time) chạy qua JobRunner: reassignExpiredReviews, closeExpiredProposals (stub nếu domain chưa có), weeklyReputationRecovery (chạy một lần/tuần, idempotent). `.github/workflows/cron.yml` mỗi 10 phút gọi endpoint bằng secret `CRON_SECRET` + biến `APP_URL`
- [x] (api) A2.4 Thẻ chia sẻ next/og: `app/og/level-up/[proofId]/route.tsx` (ảnh 1200x630, font Be Vietnam Pro có dấu tiếng Việt, huy hiệu vải thêu) + metadata OG cho trang công khai `/share/[proofId]` (ui làm trang, api làm ảnh)
- [x] (api) A2.5 Test router (quyền: người không được phân công không duyệt được, không xem được video; cron sai secret → 401)

### ui
- [ ] U2.1 Đăng bằng chứng (`/proof/new`): chọn kỹ năng/cấp, quay trong app bằng MediaRecorder 720p (ưu tiên) hoặc chọn file, giới hạn 60 MB / 3 phút, upload thẳng presigned, kết quả kiểm tra sơ bộ dạng biểu tượng, cam kết an toàn một lần, nút "Gửi xác thực"
- [ ] U2.2 Trạng thái bằng chứng của tôi (`/proofs/[id]`): tiến độ 0/3, kết quả từng tiêu chí khi trượt, nút "Kháng nghị"
- [ ] U2.3 Duyệt (`/review` hàng đợi + `/review/[assignmentId]`): ẩn danh (biểu tượng khiên + ⓘ), chấm từng tiêu chí Đạt/Chưa đạt, nhận xét, "Báo cáo" mở sheet lý do, uy tín kèm ⓘ
- [ ] U2.4 Lên cấp (`/level-up/[proofId]`): chuyển động "khâu" huy hiệu (tôn trọng prefers-reduced-motion), XP, huy hiệu, nút chia sẻ (Web Share API, fallback sao chép link)
- [ ] U2.5 Trang công khai `/share/[proofId]` (không cần đăng nhập, không lộ dữ liệu cá nhân ngoài tên hiển thị) dùng ảnh OG của api
- [ ] U2.6 Chụp màn hình + tự soi từng màn như giai đoạn 1

### qa
- [~] (qa) Q2.1 E2E chính: người dùng nộp bằng chứng (file video mẫu nhỏ trong e2e/fixtures) → 3 người duyệt (đăng nhập dev từng người được phân công) chấm Đạt → người nộp thấy Lên cấp, level tăng
- [~] (qa) Q2.2 E2E: trượt + kháng nghị; người duyệt không được phân công bị chặn; người duyệt không thấy tên người nộp
- [~] (qa) Q2.3 E2E/HTTP: /api/cron sai secret → 401, đúng secret → 200
- [~] (qa) Q2.4 Rà soát: finalizeProof là nơi duy nhất ghi level; mọi ngưỡng qua app_config; URL video là presigned có hạn; không lộ người nộp trong payload review
- [~] (qa) Q2.5 Cập nhật docs/QA.md

## Giai đoạn 3 — Xã hội và an toàn
Màn: Trang chủ (Home.html), Thử thách (Feed.html), quản trị tối giản cho biên tập viên, Hồ sơ người khác (PeerProfile.html) + trao đổi kỹ năng + nhắn tin.

### domain
- [~] (domain) D3.1 Nhiệm vụ ngày: `getDailyQuests(userId, date)` (định nghĩa từ `app_config.daily_quests`, tạo dòng daily_quests khi thiếu), `progressQuest`, chuỗi ngày (streak) ; XP quest_done qua xp_ledger + test
- [~] (domain) D3.2 Feed: `getHomeFeed(userId, cursor)` (bài lên cấp + bài đăng của người/kỹ năng đang theo dõi, rồi phổ biến), `reactToPost` (like/cheer, cập nhật like_count cùng transaction), `commentOnPost`, `createTextPost` + test
- [~] (domain) D3.3 Thử thách: `getActiveChallenges`, `joinChallenge` (gắn proof), `getPendingProofsForCommunity` (chờ duyệt, ẩn danh), đấu 1v1: `createDuel`, `voteDuel` (1 phiếu/người, không tự bầu mình, trước vote_ends_at), `closeDuels` (cron; XP challenge_won) + test
- [~] (domain) D3.4 Báo cáo + xử phạt: `createReport` (proof/user/review/post/skill), `listReports` (biên tập), `resolveReport` (confirmed/dismissed); xác nhận gian lận với proof đã đạt → `sanctions(level_revoked, proof_id)`, hạ level QUA `finalizeProof` (nhánh thu hồi — xem DECISIONS D40), xp_ledger âm (revoked), −15 uy tín người đã duyệt đạt (approved_fraud), không xóa bản ghi; `sanctionUser` (warning/review_ban/post_ban/suspension có hạn) + test
- [~] (domain) D3.5 Hồ sơ người khác & xã hội: `follow/unfollow`, `proposeSwap` / `respondSwap` / `rateSwap`, nhắn tin `getOrCreateThread`, `sendMessage`, `listThreads`, `listMessages` (chỉ 2 thành viên thread; người bị post_ban/suspension không gửi được) + test
- [~] (domain) D3.6 `weeklyReputationRecovery` (+1 mỗi tuần không vi phạm khi < `reviewer_min_reputation`, idempotent theo tuần) + test

### api
- [ ] A3.1 Router: `home.quests`, `home.feed`, `post.react`, `post.comment`, `post.create`
- [ ] A3.2 Router: `challenge.list`, `challenge.join`, `challenge.pendingProofs`, `duel.get`, `duel.vote`
- [ ] A3.3 Router `admin.*` (editorProcedure): reports list/resolve, sanctions, hàng đợi trùng hash, appeals resolve
- [ ] A3.4 Router: `social.follow/unfollow`, `swap.propose/respond/rate`, `message.threads/list/send`, `report.create`
- [ ] A3.5 Cron: thêm closeDuels, weeklyReputationRecovery thật; test quyền admin (người thường bị chặn)

### ui
- [ ] U3.1 Trang chủ (`/home`): chuỗi ngày, nhiệm vụ hôm nay (tiến độ phân số), feed lên cấp + bài đăng, thả cheer
- [ ] U3.2 Thử thách (`/challenges`): tab Đang diễn ra / Đấu 1v1 / Chờ duyệt, thử thách tuần, bỏ phiếu đấu
- [ ] U3.3 Hồ sơ người khác (`/u/[handle]`): theo dõi, nhắn tin, báo cáo (sheet), đề nghị trao đổi kỹ năng (lưu ý gặp mặt chỉ hiện sau khi chấp nhận)
- [ ] U3.4 Tin nhắn (`/messages`, `/messages/[threadId]`) tối giản
- [ ] U3.5 Quản trị biên tập viên (`/admin`): báo cáo, xử phạt, thu hồi level, trùng hash, kháng nghị — tối giản, chỉ editor thấy
- [ ] U3.6 Thông báo (chuông trên header) tối giản + chụp/tự soi

### qa
- [ ] Q3.1 E2E: trang chủ hiển thị nhiệm vụ + feed; thả cheer
- [ ] Q3.2 E2E: báo cáo bằng chứng đã đạt → biên tập viên xác nhận → level bị hạ, XP âm, người duyệt bị trừ uy tín
- [ ] Q3.3 E2E: theo dõi, nhắn tin, đề nghị trao đổi; người thường không vào được /admin
- [ ] Q3.4 E2E: bỏ phiếu đấu 1v1 (1 phiếu/người)
- [ ] Q3.5 Rà soát + docs/QA.md

## Giai đoạn 4 — Cộng đồng góp ý
Màn: Đề xuất kỹ năng mới (NewSkill.html), bỏ phiếu sửa tiêu chí trên Chi tiết kỹ năng.

### domain
- [ ] D4.1 `proposeNewSkill` (payload Zod: tên, danh mục, mô tả, 5 cấp tiêu chí, cờ rủi ro) ; `supportProposal` (support_count cùng transaction; đủ `new_skill_support_needed.supporters` trong `days` → editor_review) + test
- [ ] D4.2 `decideNewSkill` (biên tập viên): accepted → tạo skills(active), skill_levels, criteria_versions v1 + criteria, XP proposal_accepted cho tác giả, huy hiệu; risk_level=high luôn cần biên tập viên + test
- [ ] D4.3 `proposeCriteriaEdit` (skill_level_id, tiêu chí mới) ; `voteCriteriaEdit` (agree/disagree; weight=1 nếu người bỏ phiếu đạt cấp ≥ `criteria_change_rule.voter_min_level` của kỹ năng đó, ngược lại 0; 1 phiếu/người, đổi phiếu được trước hạn) + test
- [ ] D4.4 `closeCriteriaProposal` / `closeExpiredProposals` (cron): thông qua khi tỉ lệ agree ≥ agree_ratio trên tổng trọng số và số phiếu có trọng số ≥ min_votes → tạo criteria_versions mới (version+1, source_proposal_id, criteria mới), trỏ current_version_id, XP tác giả; hết hạn không đủ → expired/rejected; new_skill quá hạn không đủ ủng hộ → expired. KHÔNG UPDATE criteria + test (hòa phiếu = không thông qua, đúng ngưỡng 70%, dưới 30 phiếu, phiếu weight 0)
- [ ] D4.5 Truy vấn: `listProposals(skillId|kind)`, `getProposal`, bình luận đề xuất `commentOnProposal` + Zod
- [ ] D4.6 Nhiệm vụ ngày suggest_criteria tiến khi góp ý/bỏ phiếu + test

### api
- [ ] A4.1 Router `proposal.*`: createNewSkill, support, createCriteriaEdit, vote, list, get, comment
- [ ] A4.2 `admin.proposals` (editorProcedure): hàng đợi editor_review, decide
- [ ] A4.3 Cron gọi closeExpiredProposals thật; test router (quyền, validate)

### ui
- [ ] U4.1 Đề xuất kỹ năng mới (`/skills/propose`): tên, danh mục, tiêu chí từng cấp, cờ rủi ro, dòng tiến trình nhỏ (Ủng hộ → Duyệt → Mở) + ⓘ
- [ ] U4.2 Danh sách/chi tiết đề xuất (`/proposals`, `/proposals/[id]`): ủng hộ, bình luận
- [ ] U4.3 Chi tiết kỹ năng: khối góp ý tiêu chí — bỏ phiếu Đồng ý / Không đồng ý, tỉ lệ có trọng số, luật trong ⓘ; "Góp ý tiêu chí" mở form tạo đề xuất sửa
- [ ] U4.4 Quản trị: hàng đợi đề xuất kỹ năng chờ biên tập + chụp/tự soi

### qa
- [ ] Q4.1 E2E: đề xuất kỹ năng mới → ủng hộ → (seed/ngưỡng) → biên tập viên duyệt → kỹ năng xuất hiện ở Khám phá
- [ ] Q4.2 E2E: bỏ phiếu sửa tiêu chí → đóng qua /api/cron → phiên bản tiêu chí mới hiển thị, bằng chứng cũ vẫn giữ phiên bản cũ
- [ ] Q4.3 Rà soát (không UPDATE criteria, trọng số đúng) + docs/QA.md

## Giai đoạn 5 — Sẵn sàng triển khai demo
### lead
- [ ] L5.1 docs/DEPLOY.md: Neon (pooled + direct URL), R2 (bucket, API token, CORS cho PUT từ trình duyệt), Vercel (thư mục gốc apps/web, biến môi trường, build command), Auth.js Google OAuth + SMTP magic link, GitHub Actions secret CRON_SECRET + biến APP_URL, checklist sau triển khai
- [ ] L5.2 Script `pnpm db:deploy:neon` (migrate deploy + seed lên Neon từ env)
- [ ] L5.3 Build production chạy được cục bộ (`pnpm build && pnpm --filter @skillverse/web start`)

### api
- [ ] A5.1 Kiểm tra cấu hình production: AUTH_DEV_LOGIN bị từ chối khi NODE_ENV=production trừ khi bật rõ; header bảo mật; cron.yml dùng secret; R2 presigned hoạt động với endpoint R2 (path-style, region auto)
- [ ] A5.2 `vercel.json` (nếu cần) và kiểm tra Prisma + adapter-pg chạy trên Vercel serverless (Neon pooled)

### ui
- [ ] U5.1 PWA: icon, manifest, trang offline tối giản; giao diện sáng "giấy sổ tay" nếu kịp; soát lần cuối 360/390/768px mọi màn
- [ ] U5.2 Trạng thái rỗng / lỗi / đang tải cho mọi màn

### domain
- [ ] D5.1 Rà phủ test: assignReviewers, finalizeProof (cả thu hồi), uy tín, bỏ phiếu đề xuất, hòa phiếu/quá hạn/trùng hash; bổ sung chỗ thiếu
- [ ] D5.2 Kiểm tra tính lại cache từ sổ cái: `recomputeUserCaches(userId)` khớp total_xp/reputation + test

### qa
- [ ] Q5.1 Chạy toàn bộ e2e trên build production cục bộ
- [ ] Q5.2 Rà soát cuối theo QUY TẮC BẮT BUỘC, docs/QA.md bản cuối
