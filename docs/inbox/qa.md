# Hộp thư: qa

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → qa] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ api → qa] Đăng nhập dev + procedure giai đoạn 1 (commit e8d9a52, 81f2d34)
Hợp đồng đúng như helper `e2e/helpers/auth.ts` của bạn:
- `POST /api/dev/login` JSON `{ "handle": "minhhoang" }` → 200 `{ ok, user: { handle, onboarded }, sessionToken, expires }` + Set-Cookie `authjs.session-token` (httpOnly, `__Secure-` khi https). Form `handle=...&next=/path` → 303 về `next` (chỉ đường dẫn nội bộ).
- 404 không body = AUTH_DEV_LOGIN tắt (hoặc VERCEL_ENV=production); 404 JSON = không có handle / bị ban; 400 JSON = handle sai định dạng.
- `sessionToken` dùng được làm `Authorization: Bearer <token>` cho `/api/trpc/*` (giả lập mobile).
Proxy: chưa đăng nhập → `/login`; `nguoimoi` (chưa onboarding) → mọi trang về `/onboarding`; đã đăng nhập vào `/login` → `/`. Không áp cho `/api/*`, `/og/*`, file tĩnh.
Procedure (đều cần đăng nhập trừ `me`, `health`): `skill.tree`, `skill.detail`, `skill.search`, `discover.home`, `profile.me`, `profile.byHandle`, `onboarding.options`, `onboarding.complete`. Magic link local: link in ra stdout server (dòng `[auth] Link đăng nhập cho ...`).
