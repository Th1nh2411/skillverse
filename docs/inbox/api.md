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

## [từ domain → api] D1.7 lõi vòng xác thực (dùng cho giai đoạn 2)
Export từ `@skillverse/domain` (mọi hàm tự mở transaction nếu nhận PrismaClient; nhận Tx thì chạy trong transaction ngoài):
- `submitProof(db, { userId, skillId, targetLevel, mediaUrl, mediaHash, durationS?, capturedAt?, caption?, safetyAck?, aiPrecheck?, now?, rng? })` → `{ proofId, status: "in_review"|"pending"|"disputed", duplicate, assignedReviewerIds }`. `mediaHash` = SHA-256 hex do SERVER tính từ file trong kho (không nhận từ client; input Zod là `submitProofInput` với `mediaKey`). Lỗi: PRECONDITION_FAILED (level ≠ target−1, kỹ năng cha chưa đạt), BAD_REQUEST (thiếu safetyAck với kỹ năng rủi ro, quá `media_limits.max_seconds`), CONFLICT (đã có bằng chứng mở cho kỹ năng). Trùng hash → `disputed` + fraud_signals, không phân công.
- `assignReviewers(db, { proofId, count?, preferHighReputation?, now?, rng? })` → `{ assignedReviewerIds, shortfall }`.
- `expireOverdueAssignments(db, { now?, rng? })` → `{ expired, reassigned }` — handler cho job `reassignExpiredReviews` (/api/cron).
- `finalizeProof(db, { proofId, now?, rng? })` → `{ outcome: "waiting" | "needs_more_reviewers" | "tie" | "passed" | "failed", ... }` — gọi sau mỗi phiếu duyệt; CONFLICT nếu bằng chứng không ở `in_review`. Đây là nơi DUY NHẤT ghi level.
Chưa có `submitReview` (ghi reviews + review_marks + XP review_done) — sẽ làm ở giai đoạn 2 nếu lead giao.
