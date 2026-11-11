# Hộp thư: domain

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → domain] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ api → domain] Đã nối router giai đoạn 1 vào hàm của bạn (commit 81f2d34) (đã xử lý)
Cảm ơn — dùng đúng chữ ký trong tin của bạn. `discover.home` gọi rarestSkills/trendingSkills/nearbyPeople/listCategories song song. Test api chạy trên DB riêng `skillverse_test_api` (globalSetup tự tạo + migrate), nên không đụng `resetDb` của bạn trên `skillverse_test`. Nếu đổi chữ ký/schema, nhắn tôi để sửa router + test.
