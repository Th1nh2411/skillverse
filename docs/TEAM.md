# Cách làm việc của nhóm agent SkillVerse

Đọc file này TRƯỚC KHI làm. Lead điều phối; 4 đồng đội: domain, api, ui, qa. Tất cả làm việc trong cùng một thư mục git `/Users/nguyenthinh/WorkSpace/skillverse`, song song.

## Nguồn sự thật (đọc)
- `PROMPT.md` (khối B) — yêu cầu tổng; `docs/PRODUCT_BRIEF.md`; `docs/DATA_MODEL.md` (quy tắc nghiệp vụ BẮT BUỘC); `db/schema.sql`
- `packages/db/prisma/schema.prisma` — Prisma schema (model PascalCase, field camelCase; tên SQL qua @map). `docs/DECISIONS.md` — các quyết định đã chốt.
- `design/screens/*.html` — bố cục + luồng. `.claude/skills/skillverse-ui/SKILL.md` — bản sắc giao diện (ưu tiên hơn mockup về thẩm mỹ).

## Vùng sở hữu (CHỈ sửa file trong vùng của mình)
| Ai | Vùng |
| --- | --- |
| domain | `packages/domain/**`, `packages/validation/**` (gồm toàn bộ test Vitest) |
| api | `packages/api/**`, `apps/web/app/api/**`, `apps/web/auth.ts`, `apps/web/middleware.ts` / `proxy.ts`, `apps/web/lib/server/**`, `.github/**` , `apps/web/app/og/**` (next/og) |
| ui | `apps/web/app/**` (trừ `app/api/**`, `app/og/**`), `apps/web/components/**`, `apps/web/lib/**` (trừ `lib/server/**`), `apps/web/public/**` |
| qa | `apps/web/e2e/**`, `apps/web/playwright.config.ts`, `docs/QA.md` |
| lead | `packages/db/**`, file cấu hình gốc (package.json gốc, turbo.json, eslint, tsconfig.base, docker-compose, .env.example), `apps/web/next.config.ts`, `apps/web/package.json`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/DEPLOY.md`, `docs/TASKS.md` (cấu trúc) |

Cần đổi file ngoài vùng → nhắn chủ sở hữu qua hộp thư. Cần đổi DB schema / migration / seed → nhắn lead (`docs/inbox/lead.md`).
Đề xuất quyết định mới → ghi vào `docs/inbox/lead.md` mục "Quyết định", lead chép sang DECISIONS.md.

## Nhắn tin
- Hộp thư = `docs/inbox/<tên>.md`. Gửi: THÊM đoạn vào cuối hộp thư người nhận (`## [từ X → Y] tiêu đề`). Không sửa tin cũ của người khác.
- Đọc hộp thư của mình **khi bắt đầu và sau mỗi việc**.
- domain đổi chữ ký hàm hoặc schema Zod → nhắn NGAY cho api và ui.
- (Ngoại lệ vùng sở hữu: được phép ghi vào hộp thư của người khác và tick dòng của mình trong `docs/TASKS.md`.)

## Danh sách việc
`docs/TASKS.md`: nhận việc `[ ]` → `[~]`, xong `[x]`. Xong việc thì tự nhận việc tiếp theo của mình.

## QUY TẮC BẮT BUỘC (từ PROMPT.md)
- UI tiếng Việt, design tokens, Be Vietnam Pro, icon lucide-react, KHÔNG emoji, vùng chạm ≥ 44px, `aria-label` cho nút chỉ có icon.
- `user_skills.level` CHỈ thay đổi trong `finalizeProof()` (packages/domain), trong MỘT `prisma.$transaction`. Không chỗ nào khác ghi level (kể cả thu hồi level: dùng hàm domain riêng đã được lead duyệt — xem DECISIONS khi có).
- `xp_ledger`, `reputation_events` chỉ INSERT; `users.total_xp`, `users.reputation`, `account_level` là cache cập nhật CÙNG transaction.
- Không UPDATE bảng `criteria`; sửa tiêu chí = tạo `criteria_versions` mới.
- Mọi ngưỡng đọc từ `app_config` (`getConfig` trong packages/domain), không hard-code.
- Validate input bằng Zod (packages/validation), kiểm tra quyền ở server cho mọi thao tác. Không đưa dữ liệu cá nhân (email, id người nộp cho người duyệt...) lên URL.
- Không gọi Prisma từ component giao diện; mọi thao tác đi qua packages/api (tRPC). Logic nghiệp vụ nằm trong packages/domain, router chỉ mỏng.
- Không emoji ở bất kỳ đâu trong UI/copy. Commit message rõ ràng tiếng Anh hoặc Việt.

## Môi trường
- Node 24, pnpm 10. Docker: Postgres `localhost:5433` (user/pass `skillverse`), MinIO `localhost:9000` (minioadmin/minioadmin, bucket `skillverse-proofs`). `.env` gốc đã có (symlink trong apps/web).
- Database: dev `skillverse` (ui dùng), test Vitest `skillverse_test` (domain/api dùng, được reset tùy ý), e2e `skillverse_e2e` (qa dùng, được reset tùy ý). KHÔNG reset DB `skillverse` (dev) — nếu cần reseed nhắn lead.
- Dev server: mỗi agent dùng cổng + thư mục build riêng: ui → `NEXT_DIST_DIR=.next-ui pnpm --filter @skillverse/web exec next dev -p 3100`; qa → `NEXT_DIST_DIR=.next-e2e` cổng 3200; api nếu cần → `.next-api` cổng 3300. Chạy server ở chế độ nền và tắt khi xong.
- Đăng nhập dev: api cung cấp cách đăng nhập nhanh bằng handle seed khi `AUTH_DEV_LOGIN=true` (vd. `minhhoang`, `bientap` (biên tập viên), `nguoimoi` (chưa onboarding)).
- Thêm package: `pnpm --filter <gói-của-mình> add <pkg>`. Để tránh hai agent chạy pnpm cùng lúc, bọc lệnh bằng khóa: `until mkdir /tmp/skillverse-pnpm.lock 2>/dev/null; do sleep 3; done; pnpm --filter ... add ...; rmdir /tmp/skillverse-pnpm.lock`. Chỉ thêm package khi thật cần.
- Prisma client: `import { getPrisma, type Tx, type Prisma } from "@skillverse/db"`. Sau khi lead đổi schema: `pnpm --filter @skillverse/db generate`.

## Git
- Commit nhỏ, thường xuyên. CHỈ `git add <đường dẫn file của mình>` (không bao giờ `git add -A` / `git add .`). Không `git push`, không rebase/reset/stash/checkout file người khác.
- Nếu gặp `index.lock`: chờ vài giây rồi thử lại.
- Thêm dòng cuối commit message: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Kiểm tra trước khi báo xong một giai đoạn
Trong vùng của mình: `pnpm --filter <gói> lint`, `typecheck`, `test` xanh. Lead chạy toàn bộ `pnpm check` để chốt giai đoạn.

## Báo cáo
Khi xong việc của giai đoạn, trả lời lead ngắn gọn (≤ 20 dòng): đã làm gì, file chính, API/hàm công khai mới (chữ ký), việc còn dở, lỗi đã biết, tin nhắn đã gửi ai.
