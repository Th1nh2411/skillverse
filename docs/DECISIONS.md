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
- **D47 — Bằng chứng trùng hash** → `proofs.status = disputed` (= hàng đợi biên tập viên, không phân công) + `fraud_signals(duplicate_hash, score = số bằng chứng trùng)`.
- **D48 — Tỉ lệ đạt** so với `review_pass_ratio` (0.667) có sai số 0.0005 để đúng 2/3 phiếu được tính là đạt như DATA_MODEL ("≥ 2/3").
- **D49 — Phân công**: "cấp cao" (ưu tiên uy tín) = target_level ≥ max_level − 1. Hòa/thiếu người → thêm người duyệt uy tín cao nhất trong số hợp lệ. `users.reputation` kẹp [0,100]; `reputation_events.delta` ghi delta thực áp dụng để tổng sổ cái = cache. Huy hiệu khi đạt: `first-proof`, `max-level`, `rare-holder`/`legendary-holder` (theo độ hiếm trước khi tăng holder_count).
- **D55 — Kháng nghị overturned**: phân công vòng cũ chuyển `recused`; phiếu cũ giữ nguyên làm lịch sử nhưng không tính; `finalizeProof` chỉ đếm phiếu của vòng hiện tại.
- **D56 — Ngày của nhiệm vụ ngày** tính theo lịch Việt Nam (UTC+7). Đây là múi giờ hiển thị, không phải ngưỡng nghiệp vụ, nên để hằng số trong domain.
- **D57 — `finalizeProof` idempotent**: gọi lại trên bằng chứng đã chốt trả `already_decided`; khóa dòng proof để 3 phiếu đồng thời chỉ chốt một lần.
- **D58 — Video**: key object `proofs/<uuid>-<hmac>.<ext>` (không chứa dữ liệu cá nhân, server xác minh được chủ sở hữu); bucket private; xem qua presigned GET có hạn cho người nộp, người được phân công, biên tập viên, hoặc khi bằng chứng đã đạt. AI kiểm tra sơ bộ là mô phỏng (thời lượng, định dạng, dung lượng), chỉ tham khảo.
- **D59 — Thu hồi (D40)** đặt proof `removed`, ẩn bài level_up (`deleted_at`), giữ mọi bản ghi; idempotent (`already_revoked`).
- **D60 — Xác nhận báo cáo** đóng luôn các báo cáo đang mở khác trên cùng đối tượng. Báo cáo bằng chứng đang duyệt được xác nhận → proof `removed`, phân công treo → `recused`. Báo cáo bài viết → ẩn bài.
- **D61 — Xử phạt**: `review_ban` gỡ các lượt duyệt đang chờ (recused) và gán người khác; `suspension` cũng loại khỏi phân công; `post_ban`/`suspension` chặn đăng bài, bình luận, tin nhắn, đề nghị trao đổi.
- **D62 — Xã hội**: `like_count` = tổng cảm xúc (like + cheer). Tab "Chờ duyệt" cộng đồng luôn ẩn danh người nộp (khác mockup Feed.html có tên) để giữ quy tắc người duyệt không biết người nộp.
- **D63 — Đấu 1v1**: người tạo là một bên đấu hoặc biên tập viên (MVP: chỉ biên tập viên tạo qua trang quản trị); người đấu không được bỏ phiếu; hòa thì không ai thắng; XP người thắng = `app_config.xp_rewards.duel_won` (200, migration 0004).
- **D64 — Hồi uy tín hằng tuần** idempotent theo cửa sổ 7 ngày trượt cho từng người.
- **D65 — Thống kê "Kỹ năng" trên hồ sơ** đếm mọi kỹ năng người dùng đang theo (user_skills, kể cả cấp 0 — đang luyện).
- **D66 — Đề xuất kỹ năng mới**: tác giả tự ủng hộ khi tạo (support_count bắt đầu 1); trùng tên (bỏ dấu, không phân biệt hoa thường) với kỹ năng/đề xuất đang mở → từ chối; form 3–10 cấp (hằng số form trong validation). Mọi kỹ năng mới (kể cả rủi ro cao) đều qua biên tập viên; biên tập viên không tự duyệt đề xuất của mình. Giá trị mặc định khi tạo: `app_config.new_skill_defaults`.
- **D67 — Sửa tiêu chí** chỉ chốt sau hạn `criteria_vote_days`: số phiếu có trọng số < min_votes → `expired`; tỉ lệ < agree_ratio (kể cả hòa) → `rejected`; thông qua → criteria_versions mới (version+1, source_proposal_id), trỏ current_version_id, XP/huy hiệu tác giả. Trọng số tính tại thời điểm bỏ phiếu. Nhiệm vụ suggest_criteria tiến khi tạo đề xuất sửa, phiếu đầu tiên, hoặc bình luận đề xuất sửa.
- **D68 — Người duyệt dự phòng là biên tập viên**: kỹ năng mới chưa ai đạt cấp nên không đủ người duyệt. Khi `app_config.editor_fallback_reviewers = true` và không đủ người hợp lệ, `assignReviewers` bổ sung biên tập viên (bỏ yêu cầu cấp kỹ năng, vẫn áp dụng loại trừ, uy tín, review_ban).
- **D69 — Uy tín khởi điểm = 50** lấy theo DEFAULT của cột `users.reputation` trong schema.sql (hằng `INITIAL_REPUTATION` trong domain phải khớp cột). Đây là giá trị mặc định của schema chứ không phải ngưỡng, nên không đưa vào app_config. `recomputeUserCaches` tính lại total_xp/account_level/reputation/user_skills.xp từ sổ cái.
- **D70 — Ngoại lệ vùng sở hữu**: sau khi domain xong việc, api được phép sửa packages/domain cho các thay đổi nhỏ phục vụ router (giữ test domain xanh, báo domain + ui).
- **D71 — Trao đổi kỹ năng**: thêm màn `/swaps` để người nhận chấp nhận/từ chối, hẹn giờ, đánh dấu xong và đánh giá (mockup không có màn này).

## Auth & API
- **D50 — Auth.js v5** với adapter tự viết trên Prisma, session lưu database; cùng `session_token` dùng cho cookie (web) và `Authorization: Bearer` (mobile). Google chỉ bật khi có biến môi trường; EMAIL_SERVER trống → link magic in ra console.
- **D51 — Đăng nhập dev** (`POST /api/dev/login`) chỉ khi `AUTH_DEV_LOGIN=true`, và bị tắt cứng khi `VERCEL_ENV=production`.
- **D52 — Proxy (Next 16 `proxy.ts`)** tra `auth_sessions` để chuyển hướng `/login`, `/onboarding`; quyền thật vẫn kiểm tra trong tRPC.
- **D53 — `/api/auth/session`** chỉ trả `{expires, user:{id,name,image}}`; người dùng banned/đã xóa không có phiên; handle tự sinh từ tên bỏ dấu, trùng thì thêm `_NNNN`.
- **D54 — DB test tách riêng**: domain `skillverse_test`, api `skillverse_test_api` (tự tạo + migrate trong global-setup), e2e `skillverse_e2e`.

## Giao diện
- **D31 — Font tiêu đề Bitter** (slab, subset vietnamese, 700/800) cùng Be Vietnam Pro cho nội dung.
- **D30 — Skill thiết kế**: `.claude/skills/skillverse-ui/SKILL.md` (bản sao từ `SKILL.md` gốc) ưu tiên hơn mockup về thẩm mỹ. Plugin `frontend-design` chưa được cài trong phiên (cần chạy `/plugin install frontend-design@claude-plugins-official`); agent ui đọc trực tiếp nội dung skill đó từ marketplace cục bộ.

## Mốc kỹ năng
- **D72 — Cấp hiển thị là "mốc" có tên**. Người dùng thấy mỗi `skill_levels.level` như một mốc (`title`, vd. "Trời gió"); số cấp vẫn là nền tảng (cạnh `required_level`, điều kiện người duyệt, XP, thu hồi không đổi). "Thử thách" vẫn dành cho thử thách tuần — mốc gọi là "mốc". Mọi view domain/api có số cấp gắn kỹ năng trả thêm `levelTitle` (cạnh cây: `requiredLevelTitle`; kỹ năng người dùng: `nextLevelTitle`). Bài level_up: "<kỹ năng>: xong mốc <tên>" (dự phòng "lên cấp N" khi chưa có tên). `skill_levels.description` (migration 0006) là hướng dẫn cách đạt mốc, TÁCH khỏi tiêu chí có phiên bản: tiêu chí chấm (thường 1 = việc cần làm) vẫn chỉ đổi qua `criteria_versions` mới. Vì tên/hướng dẫn không phải tiêu chí chấm, biên tập viên sửa trực tiếp được qua `updateMilestone` / `admin.updateMilestone` (không tạo criteria_versions). Đề xuất kỹ năng mới: 3–5 mốc, mỗi mốc `{ title (1–40), description? (≤ 300), criteria }`; payload cũ không có tên vẫn đọc được (`title = null`).
- **D73 — Tự đánh dấu mốc tách khỏi level đã xác thực**. Sản phẩm ưu tiên vui và dễ dùng: người dùng tự đánh dấu xong mốc, không cần video, lưu ở bảng riêng `milestone_checks` (migration 0007). `user_skills.level` vẫn CHỈ đổi trong `finalizeProof()`. Đánh dấu phải theo thứ tự (mốc trước đã đánh dấu hoặc đã xác thực), không cần kỹ năng cha; lần đầu đánh dấu tự theo dõi kỹ năng như onboarding (`ensurePracticing`: user_skills level mặc định 0 + skill_follows). Bỏ đánh dấu chỉ với mốc tự đánh dấu cao nhất, không bỏ được mốc ≤ level đã xác thực. `selfLevel` = mốc L cao nhất mà 1..L đều đã đánh dấu hoặc đã xác thực (nên selfLevel ≥ level; tiến độ hiển thị = max(selfLevel, level) = selfLevel). Tự đánh dấu KHÔNG cho XP / uy tín (chống cày). Cây kỹ năng mở khóa kỹ năng con theo max(selfLevel, level); "mốc kế tiếp" (nextMilestone, nextLevelTitle, node.next) tính sau selfLevel. Vẫn chỉ dựa trên level đã xác thực: nộp bằng chứng (level + 1), điều kiện người duyệt, XP, huy hiệu, holder_count, trọng số phiếu, trạng thái `achieved` của nút cây, danh sách kỹ năng dạy khi trao đổi.
- **D74 — Lưu**: bảng `saves (user_id, target_type ∈ post|skill|proof, target_id)` (migration 0007, target đa hình không FK). Chỉ lưu được mục người dùng đang xem được (bài chưa ẩn của tài khoản còn hoạt động, kỹ năng active, bằng chứng đã đạt hoặc của chính mình); bỏ lưu luôn được. Danh sách chỉ chủ sở hữu đọc, mới nhất trước, con trỏ mờ; mục đã bị ẩn/gỡ sau khi lưu được bỏ qua (trang có thể ít hơn limit). Bằng chứng của người khác trong danh sách chỉ lộ tên hiển thị (như thẻ chia sẻ).
- **D75 — Video nhẹ hơn**: `app_config.media_limits` = 60 giây, 20 MB (migration 0008, giữ allowed_types) + `recorder: { height: 480, video_bits_per_second: 1500000 }` để máy quay trình duyệt ghi 480p ~1.5 Mbps (60 giây ≈ 11 MB). R2 gói miễn phí 10 GB ≈ 1000+ clip. Server vẫn chặn > max_mb khi cấp URL upload và khi xác minh object sau upload (object vượt giới hạn bị xóa). `proof.limits` trả `recorder` (api có giá trị dự phòng nếu DB chưa chạy 0008).
