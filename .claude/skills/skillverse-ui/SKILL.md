
---
name: skillverse-ui
description: Bản sắc giao diện riêng của SkillVerse. Dùng mỗi khi tạo hoặc sửa bất kỳ màn hình, component, style, copy giao diện nào trong apps/web (và apps/mobile sau này). Dùng cùng skill frontend-design.
---
# SkillVerse UI

SkillVerse là nơi người ta chứng minh mình làm được một việc bằng tay thật: nhóm lửa, thắt nút, tung hứng, huýt sáo bằng lá. Giao diện phải có cảm giác **sổ tay thực địa và huy hiệu hướng đạo**: vật liệu thật, thành tích thật. Nó không được trông như một bảng điều khiển SaaS bóng bẩy, cũng không như một game di động rẻ tiền.

Mockup trong `design/screens/` là **bản phác bố cục và luồng**, không phải bản vẽ hoàn thiện. Giữ nguyên cấu trúc thông tin, thứ tự các khối và luồng chuyển màn hình. Phần thẩm mỹ được phép và nên tinh chỉnh theo hướng dẫn dưới đây.

## Một điểm nhấn duy nhất: huy hiệu cấp độ

Dồn sự táo bạo vào **huy hiệu cấp độ**, mọi thứ xung quanh giữ yên tĩnh.

- Cấp độ và huy hiệu vẽ như **miếng vải thêu** (patch): viền khâu (đường nét đứt hoặc chấm chạy sát mép), hình khiên, tròn hoặc lục giác theo danh mục kỹ năng. Màu chỉ thêu khác nhau theo độ hiếm.
- Màn Lên cấp là khoảnh khắc chuyển động duy nhất được phép "diễn": miếng huy hiệu được "khâu" vào hồ sơ (một chuỗi chuyển động, tôn trọng `prefers-reduced-motion`).
- Ở các chỗ khác (thẻ, danh sách, nút) không trang trí thêm.

## Những thứ cần sửa so với mockup

Mockup đang dính các mặc định này. Không mang sang code:

- **Nhãn viết HOA giãn chữ** ("THỬ THÁCH TUẦN", "HUYỀN THOẠI", "AI KIỂM TRA SƠ BỘ"). Dùng chữ thường viết hoa đầu câu. Độ hiếm thể hiện bằng **chính huy hiệu**, không bằng chữ in hoa.
- **Chuỗi nối bằng dấu chấm giữa** ("Cấp 3/5 · 214 người đã đạt"). Viết thành câu hoặc tách thành hai dòng có thứ bậc rõ.
- **Thẻ giống hệt nhau** cùng bo góc, cùng nền. Phân thứ bậc: nội dung chính rộng, không khung; thông tin phụ nằm trong dòng; chỉ những gì bấm được mới là khối.
- **Nền gần đen chung chung với một màu nhấn**. Giữ tông tối nhưng ngả về rừng đêm, có chiều sâu (lớp nền xanh rêu rất đậm, bề mặt sáng dần theo độ cao), không phải #111.
- **Mũi tên "→" sau chữ trên nút**, nhãn nhỏ phía trên mọi tiêu đề, số đánh 01/02/03 khi nội dung không phải trình tự: không dùng.

## Ít chữ: hình, số và hành động nói thay lời

Người dùng đang luyện kỹ năng, không đọc tài liệu. Mỗi màn hình phải hiểu được trong 3 giây chỉ bằng cách nhìn.

**Giới hạn cứng**

- Mỗi màn hình có **một hành động chính**, nổi bật nhất. Tối đa một hành động phụ đi kèm.
- Chữ mô tả dưới tiêu đề: **tối đa 1 dòng**. Mô tả trong một thẻ hoặc dòng danh sách: **tối đa 2 dòng**.
- Nhãn nút: **1–3 từ** ("Gửi xác thực", "Tham gia", "Đạt").
- Không lặp lại thông tin mà biểu tượng, số liệu hay vị trí đã nói rõ.

**Thay chữ bằng gì**

- Trạng thái → biểu tượng + màu + hình huy hiệu, không viết câu ("Đã xác thực bởi 5 người" → dấu kiểm teal kèm số 5).
- Tiến độ → thanh tiến độ hoặc phân số ("2/3"), không viết thành câu.
- Độ hiếm → chính miếng huy hiệu, không cần chữ.
- Thời gian, số người, XP → con số với biểu tượng nhỏ đi kèm.

**Giấu luật lệ hệ thống, chỉ hiện khi cần** (progressive disclosure)

- Luật của nền tảng (cách chọn người duyệt, ngưỡng bỏ phiếu, cách tính uy tín, quy trình duyệt kỹ năng mới) không hiện sẵn trên màn hình. Đặt sau một biểu tượng ⓘ hoặc liên kết "Cách hoạt động", mở bottom sheet.
- Cảnh báo an toàn: hiện **một lần** dạng gọn ở nơi cần (màn đăng bằng chứng), không lặp ở mọi màn.
- Hướng dẫn lần đầu: hiện một lần rồi ẩn, không chiếm chỗ vĩnh viễn.

**Áp dụng cho mockup hiện tại**

- Duyệt: bỏ đoạn giải thích ẩn danh (chỉ cần biểu tượng khiên kèm ⓘ). Câu "phiếu trái với đa số sẽ giảm uy tín" chuyển vào ⓘ cạnh điểm uy tín. Nút báo cáo chỉ ghi "Báo cáo", lý do chọn trong sheet.
- Chi tiết kỹ năng: luật "70% từ người cấp 5+" vào ⓘ. Cảnh báo rủi ro thu gọn thành một biểu tượng kèm nhãn ngắn.
- Đăng bằng chứng: kết quả AI kiểm tra hiện dạng biểu tượng đạt/cảnh báo kèm vài từ. Chỉ mở rộng thành câu cho mục cảnh báo.
- Đề xuất kỹ năng: ba bước "Sau khi gửi" thay bằng một dòng tiến trình nhỏ (Ủng hộ → Duyệt → Mở) hoặc đưa vào ⓘ.
- Hồ sơ người khác: dòng lưu ý gặp mặt chỉ hiện sau khi đề nghị được chấp nhận.

**Tự kiểm tra trước khi xong một màn hình:** che hết chữ đi; nếu vẫn đoán được màn hình làm gì và nút nào cần bấm, đạt. Sau đó thử xóa từng đoạn chữ; đoạn nào xóa đi mà không ai thấy thiếu thì bỏ hẳn.

## Màu

Giữ đúng vai trò màu trong `docs/PRODUCT_BRIEF.md` (accent hổ phách cho hành động chính và XP, teal cho xác thực, đỏ cam cho báo cáo), nhưng tinh chỉnh nền:

- Nền và bề mặt: dải xanh rêu rất đậm, ví dụ khoảng #121A15 → #1A241D → #22302A (tự cân lại cho đẹp và đủ tương phản).
- Màu chữ thêu theo độ hiếm: thường (vải sáng), Hiếm (teal), Huyền thoại (hổ phách, có thêm đường chỉ thứ hai).
- Mọi chữ đạt tương phản WCAG AA (4.5:1), kể cả chữ phụ nhỏ.
- Có giao diện sáng thứ hai (giấy sổ tay, không phải màu kem mặc định của AI) nếu kịp; giao diện tối là mặc định.

## Chữ

- Be Vietnam Pro cho nội dung (hỗ trợ tiếng Việt tốt nhất).
- Có thể thêm **một** font tiêu đề có cá tính phù hợp sổ tay thực địa (ví dụ một grotesk hẹp hoặc slab). **Bắt buộc** kiểm tra font có subset `vietnamese` trên Google Fonts và hiển thị đúng dấu chồng (ề, ặ, ữ) trước khi dùng. Không đạt thì chỉ dùng Be Vietnam Pro với độ đậm và cỡ tương phản mạnh.
- Thang chữ rõ ràng, tối đa 4–5 cỡ. Số liệu (XP, thời gian, phiếu) dùng `font-variant-numeric: tabular-nums`.

## Hình ảnh và biểu tượng

- Icon nét lucide-react, cùng độ dày nét. Không emoji.
- Cây kỹ năng: đường nối như đường mòn trên bản đồ (nét đứt với nút chưa mở, nét liền với đường đã đi qua), không phải sơ đồ khối khô cứng.
- Không gradient trang trí, không bóng đổ mờ mặc định dưới mọi thẻ, không hình minh họa 3D bóng bẩy.
- Ô video chưa có nội dung: khung có tỉ lệ đúng và nhãn mô tả, không ảnh stock.

## Chuyển động

- Chỉ chuyển động khi đáp lại hành động của người dùng (mở, chọn, xác nhận) và cho khoảnh khắc lên cấp.
- Không hiệu ứng trượt lên khi cuộn cho từng khối, không hover nhấp nháy trên mọi thẻ.

## Chữ trong giao diện

- Tiếng Việt tự nhiên, câu ngắn, chủ động. Gọi tên theo cách người dùng hiểu ("Gửi xác thực", không phải "Submit proof").
- Một hành động giữ cùng một tên suốt luồng: nút "Gửi xác thực" → thông báo "Đã gửi xác thực".
- Lỗi nói rõ chuyện gì xảy ra và cách sửa, không xin lỗi chung chung. Màn hình trống là lời mời hành động ("Chưa có kỹ năng nào. Chọn kỹ năng đầu tiên").

## Mức chất lượng tối thiểu

- Đẹp ở 360px và 390px, dùng được tới máy tính bảng.
- Vùng chạm ≥ 44px, focus bàn phím nhìn thấy được, `aria-label` cho nút chỉ có icon.
- Trước khi coi một màn hình là xong: chụp màn hình (Playwright), so với mockup về bố cục, rồi tự soi theo danh sách "Những thứ cần sửa" ở trên. Bỏ bớt một chi tiết trang trí nếu còn băn khoăn.
