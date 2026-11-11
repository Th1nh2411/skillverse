# Tiến độ

Cập nhật: 2026-11-11

| Giai đoạn | Trạng thái |
| --- | --- |
| 0. Khung monorepo, DB, layout | Xong |
| 1. Hồ sơ và kỹ năng | Đang làm |
| 2. Vòng lặp xác thực | Chưa |
| 3. Xã hội và an toàn | Chưa |
| 4. Cộng đồng góp ý | Chưa |
| 5. Sẵn sàng triển khai demo | Chưa |

## Bước 0 — xong
- pnpm workspaces + Turborepo; `apps/web`, `packages/{db,domain,validation,api}`.
- docker-compose: Postgres (5433) + MinIO (9000/9001), bucket tạo tự động.
- `packages/db`: Prisma 7 schema (43 bảng, map đúng tên SQL), 3 migration, seed demo (19 kỹ năng, 11 người dùng).
- Khung tRPC (`publicProcedure`/`protectedProcedure`/`editorProcedure`, map DomainError), JobRunner, đọc app_config.
- `apps/web`: Next.js 16 App Router, Tailwind 4 token, font Be Vietnam Pro (subset vietnamese), PWA manifest, thanh điều hướng dưới 5 mục.
- lint + typecheck + test xanh; `next build` chạy được.

## Lỗi còn tồn tại
- (chưa có)
