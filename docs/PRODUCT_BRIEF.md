# SkillVerse — Product brief

## Ý tưởng

Mạng xã hội cho **mọi kỹ năng**, từ kỹ năng cơ bản (sinh tồn, sơ cứu) đến kỹ năng dị ít người biết (huýt sáo bằng lá, viết chữ ngược gương). Người dùng lên level bằng **bằng chứng (video/ảnh) được cộng đồng xác thực**, không phải tự khai báo.

**Điểm khác biệt so với đối thủ** (Skilltree, Skillorum, ProgressForge, Goodwall): các app "RPG đời thực" hiện có đều tính XP theo tự khai hoặc giờ luyện tập, không ai xác thực. SkillVerse = xác thực cộng đồng + kỹ năng ngách + mạng xã hội.

**MVP bắt đầu với 1 cụm ngách:** Sinh tồn & bushcraft (và một ít kỹ năng dị). Mở rộng sau khi vòng lặp cốt lõi giữ chân được người dùng.

## Vòng lặp cốt lõi

Chọn kỹ năng → luyện → **đăng bằng chứng** → **3 người được phân công ngẫu nhiên duyệt theo từng tiêu chí** → lên cấp, nhận XP, huy hiệu → **chia sẻ thẻ thành tích** ra ngoài → kéo người mới.

## 12 màn hình (mockup trong `design/`)

| File | Màn hình | Nội dung chính |
| --- | --- | --- |
| `Onboarding.html` | Onboarding | Chọn ≥ 3 kỹ năng, tự chọn trình độ khởi đầu (chỉ để gợi ý), thử thách đầu tiên |
| `Home.html` | Trang chủ | Chuỗi ngày, nhiệm vụ hằng ngày (luyện, duyệt, góp ý tiêu chí), feed lên cấp và bài đăng |
| `Main.html` | Hồ sơ của tôi | Cấp tổng, thanh XP, thống kê, kỹ năng nổi bật kèm độ hiếm và trạng thái xác thực |
| `SkillTree.html` | Cây kỹ năng | Các nút đã đạt / đang luyện / chưa mở, yêu cầu lên cấp tiếp theo |
| `SkillDetail.html` | Chi tiết kỹ năng | Tiêu chí 5 cấp, cảnh báo an toàn, **cộng đồng bỏ phiếu sửa tiêu chí** |
| `Proof.html` | Đăng bằng chứng | Video, AI kiểm tra sơ bộ, mô tả, cam kết an toàn |
| `Feed.html` | Thử thách | Thử thách tuần, bằng chứng chờ duyệt, đấu 1v1 |
| `Review.html` | Duyệt bằng chứng | Người nộp ẩn danh, chấm theo từng tiêu chí, nhận xét, **báo cáo gian lận**, điểm uy tín |
| `LevelUp.html` | Lên cấp | Ăn mừng, XP, huy hiệu, thẻ chia sẻ |
| `Discover.html` | Khám phá | Tìm kiếm, kỹ năng hiếm nhất, thịnh hành, người gần bạn, nút đề xuất kỹ năng |
| `PeerProfile.html` | Hồ sơ người khác | Theo dõi, nhắn tin, **báo cáo**, đề nghị trao đổi kỹ năng |
| `NewSkill.html` | Đề xuất kỹ năng mới | Tên, danh mục, tiêu chí từng cấp, cờ rủi ro, quy trình duyệt |

Mở `design/index.html` để xem tất cả cùng lúc. Các nút trong màn hình có liên kết sang nhau.

## Design tokens

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `bg` | `#11130F` | Nền trang |
| `surface` | `#1B1E17` | Thẻ, khối |
| `surface-2` | `#252920` / `#2A2E24` | Nút phụ, ô video |
| `border` | `#33382C` | Viền, đường cây kỹ năng chưa mở |
| `text` | `#F3F0E7` | Chữ chính |
| `muted` | `#A9AB9C` | Chữ phụ |
| `accent` (hổ phách) | `#E9A23B`, chữ trên nền accent `#1A1406` | Nút chính, XP, cấp, Huyền thoại |
| `accent-soft` | nền `#2A2412`, viền `#5A4520` | Thẻ nổi bật |
| `teal` | `#5CC2B0`, nền `#17302C` | Xác thực, Hiếm, trạng thái đạt |
| `danger` | `#E8735A` | Báo cáo |

- Font: **Be Vietnam Pro** (400/500/600/700/800), hỗ trợ tiếng Việt đầy đủ.
- Bo góc: 12–18px cho thẻ, 14px cho nút chính. Vùng chạm tối thiểu 44px.
- Icon: nét (stroke 2px), kiểu Lucide. Không dùng emoji.
- Giao diện tối mặc định, ưu tiên di động (390px).

## Ngoài phạm vi MVP

Thanh toán, mentor có phí, nhà tài trợ thử thách, AI chấm tự động, ứng dụng native.
