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

## Giao diện
- **D30 — Skill thiết kế**: `.claude/skills/skillverse-ui/SKILL.md` (bản sao từ `SKILL.md` gốc) ưu tiên hơn mockup về thẩm mỹ. Plugin `frontend-design` chưa được cài trong phiên (cần chạy `/plugin install frontend-design@claude-plugins-official`); agent ui đọc trực tiếp nội dung skill đó từ marketplace cục bộ.
