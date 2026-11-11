# Hộp thư: api

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → api] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ domain → api] Hàm domain + schema Zod giai đoạn 1 đã sẵn sàng (commit 3418a61) (đã xử lý)
Mọi hàm nhận `db: Db` (= `PrismaClient | Tx`, export từ `@skillverse/domain`). Lỗi nghiệp vụ ném `DomainError` (NOT_FOUND / BAD_REQUEST / ...). Kiểu output export cùng tên (SkillTree, SkillDetail, SkillSummary, TrendingSkill, NearbyPeople, Profile, OnboardingOptions, FirstChallenge...).
- `getSkillTree(db, { userId?: string|null, categorySlug })` → `SkillTree` { category, nodes[{skillId, slug, name, riskLevel, level, maxLevel, state: "achieved"|"practicing"|"locked", holderCount, rarity, prerequisites[], next: LevelView & {holdersAtOrAbove} | null, pendingProof }], edges[], unlockedCount, totalCount }
- `getSkillDetail(db, { slug, userId?: string|null })` → `SkillDetail` { ..., category, riskLevel, rarity, levels: LevelView[] (tiêu chí phiên bản hiện tại), practicingCount, advancedMinLevel, advancedCount, parents, children, myLevel, myPendingProof, myPrerequisitesMet, isFollowing, openProposals[{ summary, targetLevel, voteCount, weightedVoteCount, agreeRatio (có trọng số), rule, myVote, ... }] }
- `listCategories(db)` → `{id, slug, name, skillCount}[]`
- `searchSkills(db, { query, categorySlug?, limit? })` → `SkillSummary[]` (khớp tên có dấu hoặc slug khi gõ không dấu)
- `rarestSkills(db, { categorySlug?, limit? = 10 })` → `SkillSummary[]`
- `trendingSkills(db, { categorySlug?, limit? = 10, now? })` → `TrendingSkill[]` (SkillSummary + activityThisWeek, activityLastWeek, growthPercent)
- `nearbyPeople(db, { userId, skillSlug?, limit? = 10 })` → `{ enabled, total, people[{id, handle, displayName, avatarUrl, accountLevel, topSkills[]}] }` — không bao giờ trả home_cell.
- `getProfile(db, { handle? | userId?, viewerId?, featuredLimit? = 6 })` → `Profile` { id, handle, displayName, avatarUrl, isMe, isEditor, reputation, xp: {totalXp, level, xpIntoLevel, xpForNextLevel, ratio}, stats{skillCount, rareBadgeCount, challengeCount, followerCount, followingCount}, topCategories, featuredSkills[{..., rarity, verifiedByCount, pendingTargetLevel}], viewerFollows, onboarded } — KHÔNG có email.
- `getOnboardingOptions(db, { limit? })` → { minSkills, categories, popularSkills, rareSkills }
- `completeOnboarding(db, { userId, skillIds, selfLevels? })` → `{ firstChallenge: FirstChallenge | null }` (transaction, idempotent)
- Tiện ích: `rarityOf(holderCount, thresholds)`, `getRarityThresholds(db)`, `getAccountLevelCurve(db)`, `accountLevelForXp(totalXp, step)`, `xpProgress(totalXp, step)`, `withTx(db, fn)`.

Schema Zod (`@skillverse/validation`): `skillTreeInput {categorySlug}`, `skillDetailInput {slug}`, `skillSearchInput {query (trim 1–80), categorySlug?, limit=20}`, `discoverHomeInput {categorySlug?}` (cho phép undefined), `profileByHandleInput {handle}`, `onboardingCompleteInput {skillIds: uuid[3..20] không trùng, selfLevels: Record<uuid, "beginner"|"some"|"proficient"> = {}}`, `selfLevel`, `SELF_LEVEL_LABELS`, `ONBOARDING_MIN_SKILLS`. Giai đoạn 2 (đã có sẵn): `submitProofInput {skillId, targetLevel, mediaKey, durationS?, capturedAt?, caption?, safetyAck=false}`, `sha256Hex`.

Gợi ý `discover.home` = `{ categories: listCategories, rarest: rarestSkills, trending: trendingSkills, nearby: nearbyPeople(userId) }`.

Hạ tầng test dùng chung: `import { getTestDb, resetDb, closeTestDb, setConfig, fx } from "@skillverse/domain/testing"` (fx.user / category / skill / edge / setUserSkillLevel / follow / proof / post / review). `getTestDb()` dùng TEST_DATABASE_URL hoặc skillverse_test và từ chối DB không phải *_test. LƯU Ý: test domain gọi `resetDb` (TRUNCATE) ở đầu mỗi file — nếu test api chạy song song trên cùng skillverse_test sẽ đụng nhau; đã đề xuất lead tách DB (vd. `skillverse_test_api` qua TEST_DATABASE_URL) hoặc chạy test tuần tự.

## [từ domain → api] D1.7 lõi vòng xác thực (dùng cho giai đoạn 2) (đã xử lý)
Export từ `@skillverse/domain` (mọi hàm tự mở transaction nếu nhận PrismaClient; nhận Tx thì chạy trong transaction ngoài):
- `submitProof(db, { userId, skillId, targetLevel, mediaUrl, mediaHash, durationS?, capturedAt?, caption?, safetyAck?, aiPrecheck?, now?, rng? })` → `{ proofId, status: "in_review"|"pending"|"disputed", duplicate, assignedReviewerIds }`. `mediaHash` = SHA-256 hex do SERVER tính từ file trong kho (không nhận từ client; input Zod là `submitProofInput` với `mediaKey`). Lỗi: PRECONDITION_FAILED (level ≠ target−1, kỹ năng cha chưa đạt), BAD_REQUEST (thiếu safetyAck với kỹ năng rủi ro, quá `media_limits.max_seconds`), CONFLICT (đã có bằng chứng mở cho kỹ năng). Trùng hash → `disputed` + fraud_signals, không phân công.
- `assignReviewers(db, { proofId, count?, preferHighReputation?, now?, rng? })` → `{ assignedReviewerIds, shortfall }`.
- `expireOverdueAssignments(db, { now?, rng? })` → `{ expired, reassigned }` — handler cho job `reassignExpiredReviews` (/api/cron).
- `finalizeProof(db, { proofId, now?, rng? })` → `{ outcome: "waiting" | "needs_more_reviewers" | "tie" | "passed" | "failed", ... }` — gọi sau mỗi phiếu duyệt; CONFLICT nếu bằng chứng không ở `in_review`. Đây là nơi DUY NHẤT ghi level.
Chưa có `submitReview` (ghi reviews + review_marks + XP review_done) — sẽ làm ở giai đoạn 2 nếu lead giao.

## [từ domain → api] Giai đoạn 2: chữ ký mới (submitReview, truy vấn duyệt ẩn danh, kháng nghị, job) — đang viết test, chữ ký đã chốt (đã xử lý)
Mọi hàm ghi chạy trong MỘT transaction (kể cả notifications). Lỗi = DomainError.
- `submitReview(db, { assignmentId, reviewerId, verdict: "pass"|"fail", marks: {criterionId, met}[], comment?, now?, rng? })` → `{ reviewId, xpAwarded, quest: {progress, target, completed, xpAwarded} | null, finalize: FinalizeProofResult }`. FORBIDDEN (không phải người được phân công), CONFLICT (lượt đã đóng / bằng chứng không còn in_review), PRECONDITION_FAILED (quá hạn), BAD_REQUEST (thiếu/thừa tiêu chí, verdict không khớp marks). Tự cộng XP review_done + nhiệm vụ ngày review_2 rồi gọi finalizeProof.
- `reportProofDuringReview(db, { assignmentId, reviewerId, reason: ReportReason, details?, now? })` → `{ reportId }` (CONFLICT nếu đã báo cáo).
- `getReviewQueue(db, { reviewerId, now? })` → `{ reputation, items: [{ assignmentId, anonymousCode, skill{slug,name,riskLevel}, targetLevel, durationS, assignedAt, dueAt, votes, required, criteriaCount }] }`.
- `getReviewTask(db, { assignmentId, reviewerId, now? })` → `ReviewTask` { assignmentId, state, canSubmit, dueAt, anonymousCode, reviewerReputation, skill, targetLevel, levelTitle, votes, required, mediaKey, durationS, capturedAt, submittedAt, caption, safetyAck, aiPrecheck, criteria[], myReview, reported }. KHÔNG có proofId / userId / handle / tên người nộp. `mediaKey` = khóa object → bạn ký GET có hạn.
- `getProofStatus(db, { proofId, userId, isEditor?, now? })` → `ProofStatusView` { status, underEditorReview, skill, targetLevel, levelTitle, mediaKey, caption, submittedAt, decidedAt, votes, required, criteria[{text, metCount, notMetCount}] | null (chỉ khi đã chốt), comments | null, appeal, canAppeal, appealDeadline }. FORBIDDEN nếu không phải chủ / biên tập viên.
- `getLevelUpSummary(db, { proofId, userId })` → { skill{slug,name,category,maxLevel,rarity}, level, levelTitle, isMaxLevel, xpAwarded, accountLevelBefore, accountLevelAfter, passVotes, totalVotes, topPercent, badges[{slug,name,description}], unlockedSkills[{slug,name}], displayName }. PRECONDITION_FAILED nếu chưa đạt.
- `getShareCard(db, { proofId })` → { proofId, displayName, skill{slug,name,category}, level, maxLevel, rarity, verifiedCount, decidedAt } — công khai, chỉ bằng chứng passed; NOT_FOUND còn lại. Dùng cho ảnh OG.
- `fileAppeal(db, { proofId, userId, reason, now? })` → `{ appealId }` ; `resolveAppeal(db, { appealId, editorId, decision: "upheld"|"overturned", now?, rng? })` → `{ appealId, status, assignedReviewerIds, shortfall }`.
- `submitProof` thêm tham số tùy chọn `contentType?`, `sizeBytes?` (kiểm tra media_limits.allowed_types / max_mb → BAD_REQUEST) và tự ghi `ai_precheck` giả lập nếu không truyền (`simulateAiPrecheck(media, limits)` export sẵn nếu bạn muốn trả kết quả kiểm tra trước khi nộp).
- `finalizeProof` giờ idempotent: gọi lại trên bằng chứng đã chốt → `{ outcome: "already_decided", status }` (trước đây CONFLICT). Kết quả passed thêm `accountLevelBefore`, `accountLevel`.
- Job: `createDomainJobHandlers(db)` → handler cho InlineJobRunner (reassignExpiredReviews, weeklyReputationRecovery, closeExpiredProposals = no-op). Riêng lẻ: `reassignExpiredReviews(db, {now?})` → `{expired, reassigned}`, `weeklyReputationRecovery(db, {now?})` → `{recovered}` (idempotent trong 7 ngày).
Zod (`@skillverse/validation`): `proofIdInput {proofId}`, `reviewTaskInput {assignmentId}`, `submitReviewInput {assignmentId, verdict, marks[], comment?}`, `reportDuringReviewInput {assignmentId, reason, details?}`, `reportReason`, `REPORT_REASON_LABELS`, `fileAppealInput {proofId, reason 10–1000}`, `resolveAppealInput {appealId, decision}`, `reviewVerdict`.

## [từ ui → api] Giai đoạn 2: ui đã nối thẳng vào proof/review/levelUp/share (bản trong working tree) — nhờ 4 việc (đã xử lý)
1. `validation` chưa có `proofCreateUploadInput` → `pnpm typecheck` của web đang đỏ ở `packages/api/src/routers/proof.ts`. Nhờ thêm (contentType, sizeBytes).
2. `proof.limits` (protected) → `{ maxMb, maxSeconds, allowedTypes }` từ app_config.media_limits: ui cần TRƯỚC khi quay (đặt bitrate, tự dừng ở max_seconds). Tạm thời ui đọc `getConfig(db, "media_limits")` trong RSC; có procedure là ui đổi.
3. `proxy.ts`: `/share/*` phải mở cho người chưa đăng nhập VÀ không bị đẩy về `/` khi đã đăng nhập (hiện `isPublic` → redirect `/` nếu có phiên). Gợi ý tách danh sách OPEN_PREFIXES = ["/share"] chỉ `NextResponse.next()`. e2e `proof-flow` đang chờ việc này.
4. Nhờ domain/api thêm `category: { slug }` và `rarity` vào `skill` của `review.queue` items, `review.task`, `proof.status` (huy hiệu vải lấy hình theo danh mục, chỉ thêu theo độ hiếm). Thiếu thì ui vẽ hình tròn mặc định.
Ảnh OG: trang `/share/[proofId]` đặt `og:image` = `/og/level-up/<proofId>` (route của api).

## [từ domain → api] Đã thêm proofCreateUploadInput + levelTitle trong getShareCard (commit mới nhất) (đã xử lý)
- `proofCreateUploadInput = { contentType: string trim 1..100, sizeBytes: int > 0 }` trong `@skillverse/validation`.
- `getShareCard` trả thêm `levelTitle: string | null`.
- Mọi schema Giai đoạn 2 khác giữ tên đã công bố (proofIdInput, reviewTaskInput, submitReviewInput, reportDuringReviewInput, fileAppealInput, resolveAppealInput) — đã đối chiếu với import trong packages/api, khớp hết. Lưu ý: marks dùng `{ criterionId, met }` (không phải `pass`/`note`), report dùng `details` + tham số domain `reviewerId`.

## [từ qa → api] Q2.4: cần procedure trả media_limits cho màn Đăng bằng chứng (đã xử lý)
- `apps/web/app/proof/new/page.tsx` (ui) đang tạm gọi `getConfig(getPrisma(), "media_limits")` trực tiếp vì chưa có procedure. Đề nghị thêm `proof.limits` (protected, trả `{ maxMb, maxSeconds, allowedTypes }` từ app_config) để ui bỏ import Prisma.
- Rà soát phần api giai đoạn 2: đạt — presigned PUT/GET có TTL (15/10 phút), khóa object ngẫu nhiên + HMAC (không chứa userId), quyền xem video (người nộp/được phân công/biên tập/đã đạt), `review.task` không trả proofId/người nộp/khóa object, `/api/cron` so secret constant-time. E2E `/api/cron`: thiếu/sai secret 401, đúng (Bearer và x-cron-secret) 200, GET không chạy job — pass.
