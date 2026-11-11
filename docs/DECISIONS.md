# Quyết định kỹ thuật

Ghi lại mọi chỗ tài liệu không nói rõ và phương án đã chọn. Mới nhất ở cuối mỗi nhóm.

## Hạ tầng & công cụ
- **D01 — Agent team**: biến `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` chưa bật trong phiên này, nên lead dùng 4 subagent chạy nền (domain, api, ui, qa) với vùng thư mục riêng; danh sách việc chung ở `docs/TASKS.md`, lead chuyển tin nhắn giữa các agent.
- **D02 — Phiên bản**: Next.js 16, React 19, tRPC 11 (`@trpc/tanstack-react-query`), Prisma 7.10 (driver adapter `@prisma/adapter-pg`, `prisma.config.ts`), Zod 4, Tailwind 4 (token trong `@theme` ở `apps/web/app/globals.css`), Vitest, Playwright. TypeScript ghim `~5.9` (TS 7 bản native còn mới, tránh rủi ro tương thích với Next/ESLint).
- **D03 — Postgres local cổng 5433** (5432 trên máy dev đang bị một SSH tunnel chiếm).
- **D04 — MinIO**: image chính thức `minio/minio` đã ngừng phát hành công khai; dùng `pgsty/minio` (bản build cộng đồng của MinIO, có kèm `mc`). Bucket `skillverse-proofs` tạo tự động, private.
- **D05 — ESLint**: một cấu hình flat chung ở gốc (`eslint.config.mjs`), có luật chặn emoji trong literal.

## Database
- **D10 — Nguồn sự thật schema là `packages/db/prisma/migrations`**. `0001_init` = nguyên văn `db/schema.sql`; Prisma schema sinh bằng introspection rồi đổi tên model sang PascalCase/field camelCase, giữ tên bảng/cột bằng `@@map/@map`. `prisma migrate diff` xác nhận schema ↔ DB khớp tuyệt đối.
- **D11 — Bảng bổ sung cho Auth.js** (`0002_auth`): `auth_accounts`, `auth_sessions`, `auth_verification_tokens`, cột `users.email_verified`, `users.onboarded_at`. Không sửa bảng/cột có sẵn. `auth_sessions.session_token` dùng chung cho cookie (web) và Bearer (mobile).
- **D12 — Ngưỡng bổ sung trong app_config** (`0003_app_config_extra`): `account_level_curve` (XP từ cấp L lên L+1 = step·L, step=100), `reviewer_exclusion_days` (30), `media_limits` (60 MB, 180 s), `appeal_window_days` (7), `criteria_vote_days` (14), `daily_quests` (định nghĩa 3 nhiệm vụ ngày).
- **D13 — Seed đặt `user_skills.level` trực tiếp** cho người dùng demo (dữ liệu khởi tạo, không phải luồng ứng dụng). XP seed vẫn đi qua `xp_ledger` (`ref_type='seed'`), `users.total_xp` tính lại từ sổ cái; uy tín seed có `reputation_events` (`reason='seed'`). Code ứng dụng chỉ ghi level trong `finalizeProof()`.
- **D14 — `skill_levels.min_reviewer_level = max(1, level−1)`** trong seed để có đủ người duyệt cho demo; `xp_reward = 100·level`.

## Video
- **D20 — Hash video = SHA-256 của file** (khác DATA_MODEL.md: perceptual hash). TODO bản chính thức: perceptual hash (vd. pHash khung hình qua ffmpeg) để bắt video gần trùng.

## Nghiệp vụ
- **D40 — Thu hồi level vẫn đi qua `finalizeProof()`**. DATA_MODEL yêu cầu hạ `user_skills.level` khi báo cáo gian lận được xác nhận, trong khi quy tắc bắt buộc nói chỉ `finalizeProof()` ghi level. Giải pháp: `finalizeProof` có nhánh thu hồi (`outcome: "revoked"`, kèm report/sanction) — vẫn là hàm DUY NHẤT ghi level, trong một transaction: tạo `sanctions(level_revoked, proof_id)`, đặt level = target_level − 1 (nếu đang ≥ target_level), dòng âm `xp_ledger(revoked)`, −15 uy tín người duyệt đạt, cập nhật holder_count; không xóa bản ghi nào.
- **D41 — Kháng nghị được chấp nhận (`overturned`)** không ghi level trực tiếp: mở một vòng duyệt mới với người duyệt khác; kết quả vẫn chốt bằng `finalizeProof`.

- **D42 — Cây kỹ năng**: nút `achieved` khi level = max_level; `locked` khi có kỹ năng cha chưa đạt required_level; còn lại `practicing` (kể cả level 0).
- **D43 — "Huy hiệu hiếm" trên hồ sơ** = số kỹ năng người dùng đạt cấp ≥ 1 mà kỹ năng đó Hiếm/Huyền thoại (không phải bảng user_badges).
- **D44 — "Đạt cấp cao"** ở chi tiết kỹ năng = level ≥ max_level − 1.
- **D45 — Số kỹ năng tối thiểu khi onboarding (3)** là hằng số form (`ONBOARDING_MIN_SKILLS` trong packages/validation), không phải ngưỡng nghiệp vụ nên không đưa vào app_config.
- **D46 — Khám phá**: "Hiếm nhất" bỏ kỹ năng holder_count = 0; "Thịnh hành" growth = (tuần này − tuần trước)/max(tuần trước, 1), chỉ lấy growth > 0.

## Auth & API
- **D50 — Auth.js v5** với adapter tự viết trên Prisma, session lưu database; cùng `session_token` dùng cho cookie (web) và `Authorization: Bearer` (mobile). Google chỉ bật khi có biến môi trường; EMAIL_SERVER trống → link magic in ra console.
- **D51 — Đăng nhập dev** (`POST /api/dev/login`) chỉ khi `AUTH_DEV_LOGIN=true`, và bị tắt cứng khi `VERCEL_ENV=production`.
- **D52 — Proxy (Next 16 `proxy.ts`)** tra `auth_sessions` để chuyển hướng `/login`, `/onboarding`; quyền thật vẫn kiểm tra trong tRPC.
- **D53 — `/api/auth/session`** chỉ trả `{expires, user:{id,name,image}}`; người dùng banned/đã xóa không có phiên; handle tự sinh từ tên bỏ dấu, trùng thì thêm `_NNNN`.
- **D54 — DB test tách riêng**: domain `skillverse_test`, api `skillverse_test_api` (tự tạo + migrate trong global-setup), e2e `skillverse_e2e`.

## Giao diện
- **D31 — Font tiêu đề Bitter** (slab, subset vietnamese, 700/800) cùng Be Vietnam Pro cho nội dung.
- **D30 — Skill thiết kế**: `.claude/skills/skillverse-ui/SKILL.md` (bản sao từ `SKILL.md` gốc) ưu tiên hơn mockup về thẩm mỹ. Plugin `frontend-design` chưa được cài trong phiên (cần chạy `/plugin install frontend-design@claude-plugins-official`); agent ui đọc trực tiếp nội dung skill đó từ marketplace cục bộ.
