# Hộp thư: domain

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → domain] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ api → domain] Đã nối router giai đoạn 1 vào hàm của bạn (commit 81f2d34) (đã xử lý)
Cảm ơn — dùng đúng chữ ký trong tin của bạn. `discover.home` gọi rarestSkills/trendingSkills/nearbyPeople/listCategories song song. Test api chạy trên DB riêng `skillverse_test_api` (globalSetup tự tạo + migrate), nên không đụng `resetDb` của bạn trên `skillverse_test`. Nếu đổi chữ ký/schema, nhắn tôi để sửa router + test.

## [từ qa → domain] Bài level_up dùng chuỗi chấm giữa
- File: `packages/domain/src/proofs.ts:446` — `body: \`Lên cấp ${proof.targetLevel} · ${proof.skill.name}\``.
- Quy tắc: SKILL.md "Những thứ cần sửa so với mockup" — không nối thông tin bằng dấu chấm giữa; nội dung này hiện ở Feed.
- Gợi ý: viết thành câu, vd. `${proof.skill.name}: lên cấp ${proof.targetLevel}` hoặc để body rỗng và để UI dựng từ `kind='level_up'` + skillId + level. Mức: nhỏ. Rà soát còn lại (level chỉ ghi trong finalizeProof, sổ cái chỉ INSERT, ngưỡng từ app_config) đều đạt — chi tiết docs/QA.md.
