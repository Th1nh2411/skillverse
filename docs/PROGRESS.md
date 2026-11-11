# Tiến độ

Cập nhật: 2026-11-11

| Giai đoạn | Trạng thái |
| --- | --- |
| 0. Khung monorepo, DB, layout | Xong |
| 1. Hồ sơ và kỹ năng | Xong |
| 2. Vòng lặp xác thực | Xong |
| 3. Xã hội và an toàn | Đang làm (domain + api xong phần mình) |
| 4. Cộng đồng góp ý | Chưa |
| 5. Sẵn sàng triển khai demo | Chưa |

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

## Lỗi còn tồn tại
- Bỏ phiếu sửa tiêu chí chưa có nút (Giai đoạn 4). Vài liên kết tới màn giai đoạn sau còn 404 (/proof/new?skill=, /skills/new, /u/<handle>).
- Ổ đĩa máy dev còn ~5 GB.
