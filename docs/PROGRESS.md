# Tiến độ

Cập nhật: 2026-11-12

| Giai đoạn | Trạng thái |
| --- | --- |
| 0. Khung monorepo, DB, layout | Xong |
| 1. Hồ sơ và kỹ năng | Xong |
| 2. Vòng lặp xác thực | Xong |
| 3. Xã hội và an toàn | Xong |
| 4. Cộng đồng góp ý | Xong |
| 5. Sẵn sàng triển khai demo | Xong |

## Bước 0 — xong
- pnpm workspaces + Turborepo; `apps/web`, `packages/{db,domain,validation,api}`.
- docker-compose: Postgres (5433) + MinIO (9000/9001), bucket tạo tự động.
- `packages/db`: Prisma 7 schema (43 bảng, map đúng tên SQL), 3 migration, seed demo (19 kỹ năng, 11 người dùng).
- Khung tRPC (`publicProcedure`/`protectedProcedure`/`editorProcedure`, map DomainError), JobRunner, đọc app_config.
- `apps/web`: Next.js 16 App Router, Tailwind 4 token, font Be Vietnam Pro (subset vietnamese), PWA manifest, thanh điều hướng dưới 5 mục.
- lint + typecheck + test xanh; `next build` chạy được.

## Giai đoạn 1 — xong
- domain: cây kỹ năng, chi tiết kỹ năng, khám phá (tìm kiếm, hiếm nhất, thịnh hành, gần bạn), hồ sơ, onboarding, độ hiếm, cấp tài khoản; làm trước lõi submitProof/assignReviewers/finalizeProof. 48 test.
- api: Auth.js (Google, magic link, đăng nhập dev), cookie + Bearer, proxy chuyển hướng, router giai đoạn 1. 18 test.
- ui: bộ thành phần (huy hiệu vải thêu, sheet ⓘ...), Đăng nhập, Onboarding, Hồ sơ, Cây kỹ năng, Chi tiết kỹ năng, Khám phá; chụp và soi 360/390px.
- qa: Playwright 32 e2e xanh 2 lần liên tiếp; rà soát quy tắc bắt buộc đạt (docs/QA.md).
- Cổng: lint + typecheck + test + e2e + next build xanh.

## Giai đoạn 2 — xong
- domain: submitProof (giới hạn media, trùng hash → disputed), assignReviewers (điều kiện + loại trừ), submitReview, finalizeProof (1 transaction, idempotent, an toàn khi 3 phiếu đồng thời), kháng nghị, gán lại khi quá hạn, hồi uy tín tuần. 
- api: upload presigned PUT lên MinIO/R2 + SHA-256 server, URL xem có hạn theo quyền, router proof/review/levelUp/share, POST /api/cron + GitHub Actions mỗi 10 phút, ảnh OG thẻ chia sẻ, header bảo mật.
- ui: Đăng bằng chứng (quay MediaRecorder 720p hoặc chọn file), Trạng thái bằng chứng + kháng nghị, Duyệt ẩn danh theo tiêu chí + báo cáo, Lên cấp (huy hiệu "khâu"), trang chia sẻ công khai.
- qa: e2e nộp → 3 người duyệt → lên cấp; trượt + kháng nghị; chặn người không được phân công; cron secret.
- Cổng: lint + typecheck + 129 unit test + 46 e2e + next build xanh.

## Giai đoạn 3 — xong
- Trang chủ (nhiệm vụ ngày, chuỗi ngày, feed, cheer), Thử thách (thử thách tuần, đấu 1v1, chờ duyệt ẩn danh), Hồ sơ người khác + theo dõi + nhắn tin + trao đổi kỹ năng (/swaps), Thông báo, Quản trị biên tập viên (báo cáo, xử phạt, thu hồi level, trùng hash, kháng nghị).
- e2e: thu hồi level (level hạ, XP âm, −15 uy tín người duyệt, không xóa bản ghi), quyền admin, nhắn tin, đấu 1v1. 61/61 xanh 2 lần (chế độ E2E_PROD=1).

## Giai đoạn 4–5 — xong
- domain: đề xuất kỹ năng mới, sửa tiêu chí có trọng số, closeExpiredProposals, người duyệt dự phòng (D68), recomputeUserCaches. 93 test.
- api: router proposal.*, admin.proposals; header bảo mật, vercel.json. 41 test.
- ui: form đề xuất, danh sách/chi tiết đề xuất, bỏ phiếu trên Chi tiết kỹ năng, quản trị đề xuất; PWA (icon, service worker offline), giao diện sáng "giấy sổ tay", trạng thái rỗng/lỗi/đang tải.
- lead: DEPLOY.md, `pnpm db:deploy:remote`, build production cục bộ chạy được.

## Kiểm tra cuối (2026-11-12)
- `pnpm check`: lint + typecheck xanh; 152 unit test (domain 93, api 41, validation 18).
- `E2E_PROD=1 pnpm e2e`: 72/72 Playwright (giai đoạn 1–5), xanh nhiều lần liên tiếp.
- `pnpm build` + `next start` cục bộ: chạy được; cron không secret → 401, đăng nhập dev tắt ở production, có CSP.

## Lỗi còn tồn tại
- Trang "không tìm thấy" trả HTTP 200 thay vì 404 ở các segment có `loading.tsx` (do streaming); nội dung vẫn chặn đúng và có `noindex`. Sửa sau: kiểm tồn tại/quyền ở `layout.tsx`.
- Chưa chạy thử thật trên Vercel + Neon + R2 (cần tài khoản) — làm theo docs/DEPLOY.md.
- Hash video là SHA-256 (D20); perceptual hash để bản chính thức.
- DB dev `skillverse` còn dữ liệu thử của các agent; `SEED_RESET=1 pnpm db:seed` để làm sạch.
- Ổ đĩa máy dev còn ~5 GB.
