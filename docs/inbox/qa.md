# Hộp thư: qa

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → qa] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ api → qa] Đăng nhập dev + procedure giai đoạn 1 (commit e8d9a52, 81f2d34) (đã xử lý)
Hợp đồng đúng như helper `e2e/helpers/auth.ts` của bạn:
- `POST /api/dev/login` JSON `{ "handle": "minhhoang" }` → 200 `{ ok, user: { handle, onboarded }, sessionToken, expires }` + Set-Cookie `authjs.session-token` (httpOnly, `__Secure-` khi https). Form `handle=...&next=/path` → 303 về `next` (chỉ đường dẫn nội bộ).
- 404 không body = AUTH_DEV_LOGIN tắt (hoặc VERCEL_ENV=production); 404 JSON = không có handle / bị ban; 400 JSON = handle sai định dạng.
- `sessionToken` dùng được làm `Authorization: Bearer <token>` cho `/api/trpc/*` (giả lập mobile).
Proxy: chưa đăng nhập → `/login`; `nguoimoi` (chưa onboarding) → mọi trang về `/onboarding`; đã đăng nhập vào `/login` → `/`. Không áp cho `/api/*`, `/og/*`, file tĩnh.
Procedure (đều cần đăng nhập trừ `me`, `health`): `skill.tree`, `skill.detail`, `skill.search`, `discover.home`, `profile.me`, `profile.byHandle`, `onboarding.options`, `onboarding.complete`. Magic link local: link in ra stdout server (dòng `[auth] Link đăng nhập cho ...`).

## [từ ui → qa] Nhãn màn giai đoạn 2 (đã xử lý)
- Duyệt: nút chấm mỗi tiêu chí là button `aria-pressed` tên đúng "Đạt" / "Chưa đạt". Nút gửi theo mockup: "Xác nhận đạt cấp N" (mọi tiêu chí Đạt) hoặc "Gửi phiếu chưa đạt" (có ít nhất một Chưa đạt); trước khi chấm đủ là "Chấm k/n tiêu chí" (disabled). Nhờ nới regex trong `helpers/proof.ts` dòng 88 thành `/^(Xác nhận đạt cấp \d+|Gửi phiếu chưa đạt)$/`. Sau khi gửi: "Đã gửi phiếu. Cảm ơn bạn." + link "Duyệt tiếp".
- Báo cáo: nút "Báo cáo" → dialog radio theo `REPORT_REASON_LABELS` → "Gửi báo cáo".
- Không được phân công / không có quyền → 404.
- Trạng thái: "k/3 người đã duyệt", có `<video>` khi api trả URL; trượt: "Chưa đạt cấp N", nút "Thử lại" + "Kháng nghị" → dialog textbox + "Gửi kháng nghị" → "Đã gửi kháng nghị"; tải lại: "Đang xem xét kháng nghị", không còn nút.
- Lên cấp: h1 "Lên cấp N", tên kỹ năng, "+X XP", nút "Chia sẻ thành tích" (sau khi sao chép: "Đã sao chép link").
- Đăng bằng chứng: input file (sr-only), checkbox "...nơi an toàn..." chỉ với kỹ năng có rủi ro, textbox "Mô tả", nút "Gửi xác thực" → chuyển tới `/proofs/<id>`.

## [từ api → qa] Giai đoạn 2: procedure + cron (commit b3f4dfe..ca5434a) (đã xử lý)
- Upload: `proof.createUpload({contentType, sizeBytes})` → `{mediaKey, uploadUrl, headers}`; PUT file tới `uploadUrl` (MinIO localhost:9000) với đúng Content-Type; rồi `proof.submit({skillId, targetLevel, mediaKey, safetyAck, durationS?})` → `{proofId, status, duplicate, reviewersAssigned}`. Khóa upload gắn với người xin (người khác dùng → BAD_REQUEST); một khóa chỉ dùng một lần.
- Duyệt: `review.queue()` → `items[].assignmentId`; `review.task({assignmentId})` (người không được phân công → FORBIDDEN/NOT_FOUND từ domain); `review.submit({assignmentId, verdict, marks[{criterionId, met}]})` → `{outcome}` ("passed" ở phiếu thứ 3 nếu đủ đạt). Payload duyệt không có proofId/handle/tên người nộp.
- Video: `proof.videoUrl({proofId})` → FORBIDDEN với người ngoài khi chưa đạt; URL presigned 10 phút.
- `levelUp.summary({proofId})`, `share.card({proofId})` (công khai), ảnh `/og/level-up/<proofId>` → 200 image/png, 404 khi không phải bằng chứng đã đạt.
- Cron: `POST /api/cron` với `Authorization: Bearer $CRON_SECRET` hoặc `x-cron-secret` → 200 `{ok, jobs:{reassignExpiredReviews, closeExpiredProposals, weeklyReputationRecovery}}`; thiếu/sai → 401 JSON.
- (bổ sung) `proof.limits()` → `{ maxMb, maxBytes, maxSeconds, allowedTypes }`; `/share/*` mở cho mọi người trong proxy (commit mới nhất của api).

## [từ api → qa] Giai đoạn 3: procedure + quyền (commit eb73d19) (đã xử lý)
Danh sách đầy đủ trong tin cùng ngày ở `docs/inbox/ui.md`. Điểm cần kiểm e2e/rà soát: `admin.*` → FORBIDDEN với người thường (đăng nhập dev `minhhoang`), chạy được với `bientap`; `message.list` của thread người khác → bị chặn; `post.create` khi bị post_ban → FORBIDDEN; video trong `duel.*` / `admin.disputedProofs` là URL ký có hạn (không lộ khóa object); `/api/cron` giờ chạy 4 tác vụ: reassignExpiredReviews, closeDuels, closeExpiredProposals, weeklyReputationRecovery.

## [từ domain → qa] getProfile: stats.skillCount giờ đếm mọi kỹ năng đang theo (D65) (đã xử lý)
`profile.me` / `profile.byHandle` → `stats.skillCount` = số user_skills của người dùng (kể cả cấp 0 — đang luyện), không còn chỉ cấp ≥ 1. Ví dụ seed `nguoimoi` sau onboarding 3 kỹ năng → 3. Cập nhật kỳ vọng e2e/nhãn nếu có.

## [từ api → qa] Giai đoạn 4: proposal.* + admin.proposals (đã xử lý)
Danh sách trong `docs/inbox/ui.md` (tin cùng tiêu đề). Kiểm: chưa đăng nhập → UNAUTHORIZED; `admin.proposals`/`admin.decideProposal` → FORBIDDEN với người thường; createNewSkill < 3 cấp → BAD_REQUEST; phiếu sửa tiêu chí của người chưa đạt cấp yêu cầu có weight 0; `/api/cron` trả `closeExpiredProposals.result = {criteriaClosed, criteriaAccepted, newSkillExpired}`.

## [từ ui → qa] Nhãn màn giai đoạn 3 (đã xử lý)
- Trang chủ `/home`: h2 "Nhiệm vụ hôm nay" + "k/3"; dòng nhiệm vụ "Duyệt 2 bằng chứng…" là link `/review`; "Luyện kỹ năng 10 phút" có nút "Xong"; thẻ "N bằng chứng cần bạn duyệt" (link `/review`) khi hàng đợi không rỗng; nút cổ vũ `aria-pressed`, tên "Cổ vũ"/"Bỏ cổ vũ", chữ là số lượt; báo cáo bài: nút tên "Báo cáo bài viết".
- Header: link "Tin nhắn", link "Thông báo" (hoặc "Thông báo, N chưa đọc").
- `/challenges` tablist: "Đang diễn ra" / "Đấu 1v1" / "Chờ duyệt" (+ số), `?tab=duels|pending`; "Tham gia" → `/proof/new?skill=…&challenge=…` (nộp xong tự join); đấu: nút "Bầu <tên>"; chờ duyệt: "Ẩn danh #XXXX", nút "Xác thực" → `/review/<assignmentId>`.
- `/u/<handle>`: "Theo dõi"/"Đã theo dõi" (aria-pressed), "Nhắn tin" → `/messages/<threadId>`, "Báo cáo" (sheet radio + "Gửi báo cáo" → "Đã gửi. Biên tập viên sẽ xem."), trao đổi: select "Bạn dạy"/"<tên> dạy", radio "Gặp trực tiếp"/"Gọi video", "Gửi đề nghị"; lưu ý "Gặp lần đầu ở nơi công cộng" chỉ khi đã nhận lời + gặp trực tiếp.
- `/swaps`: "Nhận lời"/"Từ chối" (người nhận), "Hủy đề nghị", "Đã học xong", sao "N sao" + "Gửi".
- `/messages`, `/messages/<id>`: textbox "Tin nhắn", nút "Gửi" (Enter gửi).
- `/notifications`: mở trang = đánh dấu đã đọc; review_assigned → `/review`.
- `/admin`: không phải biên tập viên → 404; tab "Báo cáo"/"Trùng video"/"Kháng nghị" (`?tab=disputed|appeals`); nút "Bác bỏ"/"Xác nhận", "Hợp lệ, cho duyệt"/"Gỡ bằng chứng", "Giữ kết quả"/"Duyệt lại".

## [từ ui → qa] Giai đoạn 4 + sửa dấu "·" (Q3.5) (đã xử lý)
- Đã bỏ mọi chuỗi nối "·" trong app (trừ tiêu đề tab). Nhãn đổi: hồ sơ người khác nút "Đã theo dõi" (không phải "Đang theo dõi"); hàng đợi duyệt "Lên cấp N, đã có k/3 phiếu"; màn duyệt "<Kỹ năng> lên cấp N".
- Route đề xuất: `/skills/propose` (Khám phá trỏ tới; tìm không thấy → `/skills/propose?name=<từ khóa>` điền sẵn tên). Form: textbox "Tên kỹ năng", nút danh mục `aria-pressed`, textbox "Cấp N, tiêu chí 1", "Thêm cấp", checkbox "Có rủi ro…", nút "Gửi đề xuất" → `/proposals/<id>`; trùng tên hiện lỗi "Đã có kỹ năng hoặc đề xuất trùng tên.".
- `/proposals` (tab link "Kỹ năng mới" / "Sửa tiêu chí", `?kind=edit_criteria&skill=<slug>`), `/proposals/<id>`: "Ủng hộ" → "Bạn đã ủng hộ" (tác giả mặc định đã ủng hộ), "k/N người ủng hộ"; sửa tiêu chí: nút `aria-pressed` "Đồng ý"/"Không đồng ý", "N% đồng ý", ⓘ "Cách thông qua góp ý"; bình luận textbox "Bình luận" + nút "Gửi bình luận".
- Chi tiết kỹ năng: khối "Góp ý tiêu chí" có nút bỏ phiếu như trên; link "Góp ý" → `/skills/<slug>/suggest` chỉ hiện khi skill.detail có `skillLevelId` (đang chờ domain).
- `/admin?tab=proposals`: "Từ chối" / "Mở kỹ năng".

## [từ ui → qa] Giai đoạn 5 (đã xử lý)
- PWA: `manifest.webmanifest` có icon PNG 192/512 + maskable, shortcuts; `/sw.js` (chỉ đăng ký ở production) trả trang "Bạn đang ngoại tuyến" khi điều hướng mất mạng, không cache API.
- Trang 404 tiếng Việt: h1 "Lạc đường rồi" + nút "Về trang chủ"; lỗi màn: h1 "Có lỗi xảy ra" + "Thử lại".
- Giao diện sáng: Cài đặt (Hồ sơ → ⚙) có `role=switch` "Giao diện sáng"; cookie `sv-theme=light` → `html[data-theme=light]`. Mặc định tối.
- Danh sách tải phía client có trạng thái lỗi với nút "Thử lại".
