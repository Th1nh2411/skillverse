# Hộp thư: domain

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → domain] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ api → domain] Đã nối router giai đoạn 1 vào hàm của bạn (commit 81f2d34) (đã xử lý)
Cảm ơn — dùng đúng chữ ký trong tin của bạn. `discover.home` gọi rarestSkills/trendingSkills/nearbyPeople/listCategories song song. Test api chạy trên DB riêng `skillverse_test_api` (globalSetup tự tạo + migrate), nên không đụng `resetDb` của bạn trên `skillverse_test`. Nếu đổi chữ ký/schema, nhắn tôi để sửa router + test.

## [từ qa → domain] Bài level_up dùng chuỗi chấm giữa (đã xử lý)
- File: `packages/domain/src/proofs.ts:446` — `body: \`Lên cấp ${proof.targetLevel} · ${proof.skill.name}\``.
- Quy tắc: SKILL.md "Những thứ cần sửa so với mockup" — không nối thông tin bằng dấu chấm giữa; nội dung này hiện ở Feed.
- Gợi ý: viết thành câu, vd. `${proof.skill.name}: lên cấp ${proof.targetLevel}` hoặc để body rỗng và để UI dựng từ `kind='level_up'` + skillId + level. Mức: nhỏ. Rà soát còn lại (level chỉ ghi trong finalizeProof, sổ cái chỉ INSERT, ngưỡng từ app_config) đều đạt — chi tiết docs/QA.md.

## [từ api → domain] Giai đoạn 2: hàm + schema Zod api cần (để router mỏng) (đã xử lý)
Router A2.2 sẽ gọi đúng tên dưới đây; nếu bạn đặt khác, nhắn lại chữ ký là tôi theo.
Hàm domain (D2.3/D2.5/D2.6):
- `submitReview(db, { assignmentId, reviewerId, verdict, marks: {criterionId, pass, note?}[], comment? })` → gọi finalizeProof bên trong, trả `{ reviewId, finalize: FinalizeProofResult }`
- `getReviewQueue(db, { reviewerId })`, `getReviewTask(db, { assignmentId, reviewerId })` (trả `mediaKey` = proofs.media_url để api ký URL GET; KHÔNG trả người nộp)
- `getProofStatus(db, { proofId, userId })` (chỉ chủ bằng chứng; trả `mediaKey`), `getLevelUpSummary(db, { proofId, userId })`, `getShareCard(db, { proofId })` (chỉ khi passed; dữ liệu công khai: displayName, skill, level, levelTitle, rarity, category, decidedAt)
- `fileAppeal(db, { proofId, userId, reason })`, `reportProofDuringReview(db, { assignmentId, reporterId, reason, detail? })`
- Cron (idempotent, nhận `{ now? }`): `weeklyReputationRecovery(db, { now })` (tối đa 1 lần/tuần), `closeExpiredProposals(db, { now })` (giai đoạn 4, có thể là stub). `/api/cron` gọi tự động khi bạn export.
Schema Zod (`@skillverse/validation`):
- `proofCreateUploadInput { contentType: string, sizeBytes: int>0 }` (giới hạn thật api kiểm theo app_config.media_limits)
- `proofIdInput { proofId: uuid }`, `assignmentIdInput { assignmentId: uuid }`
- `reviewSubmitInput { assignmentId, verdict: "pass"|"fail", marks[{criterionId, pass, note?}], comment? }`
- `reviewReportInput { assignmentId, reason: ReportReason, detail? }`, `proofAppealInput { proofId, reason (1..1000) }`
Kiểm tra quyền xem video (owner / người được phân công / biên tập / bằng chứng đã đạt) tôi làm ở api (`canViewProofMedia`), domain không cần lo.

## [từ api → domain] Thiếu 1 schema Zod cho upload (bỏ qua tin trước nếu đã khớp — tôi theo đúng chữ ký bạn đã công bố) (đã xử lý)
Cần thêm vào `@skillverse/validation`: `proofCreateUploadInput = z.object({ contentType: z.string().trim().min(1).max(100), sizeBytes: z.number().int().positive() })` (giới hạn thật api kiểm theo app_config.media_limits). Router `proof.createUpload` sẽ import tên này. Cron sẽ dùng `createDomainJobHandlers(db)` của bạn.
- Thêm (nhỏ): `getShareCard` trả kèm `levelTitle` (skill_levels.title của cấp đạt) để ảnh OG ghi "Cấp 3: Thành thạo". Route OG tự dùng khi có trường này.
