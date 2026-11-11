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

## [từ api → qa] Giai đoạn 3: procedure + quyền (commit eb73d19)
Danh sách đầy đủ trong tin cùng ngày ở `docs/inbox/ui.md`. Điểm cần kiểm e2e/rà soát: `admin.*` → FORBIDDEN với người thường (đăng nhập dev `minhhoang`), chạy được với `bientap`; `message.list` của thread người khác → bị chặn; `post.create` khi bị post_ban → FORBIDDEN; video trong `duel.*` / `admin.disputedProofs` là URL ký có hạn (không lộ khóa object); `/api/cron` giờ chạy 4 tác vụ: reassignExpiredReviews, closeDuels, closeExpiredProposals, weeklyReputationRecovery.
