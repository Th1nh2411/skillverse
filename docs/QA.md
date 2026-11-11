# QA — SkillVerse

Chủ sở hữu: qa. Tổng hợp trạng thái e2e, kết quả rà soát code theo QUY TẮC BẮT BUỘC (docs/TEAM.md) + docs/DATA_MODEL.md, và a11y.

## Cách chạy e2e

```bash
pnpm e2e                                   # reset + seed DB skillverse_e2e, tự bật next dev :3200 (.next-e2e)
E2E_REUSE_SERVER=1 pnpm e2e                # dùng lại server đang chạy ở :3200
E2E_SKIP_SEED=1 ... playwright test skills # bỏ reset/seed khi chạy lặp test không đổi dữ liệu
E2E_SERVER_LOG=1 pnpm e2e                  # in log của next dev
```

- Cấu hình: `apps/web/playwright.config.ts`, môi trường `apps/web/e2e/env.ts` (từ chối mọi DB không có hậu tố `_e2e`).
- `e2e/global-setup.ts`: `prisma migrate deploy` + `SEED_RESET=1 pnpm --filter @skillverse/db seed` với `DATABASE_URL/DIRECT_URL` trỏ `skillverse_e2e`.
- Đăng nhập: `loginAs(page, "minhhoang")` (`e2e/helpers/auth.ts`) gọi `POST /api/dev/login`; endpoint chưa có → test skip có ghi chú.
- A11y cơ bản: `expectBasicA11y(page, tên màn)` (`e2e/helpers/a11y.ts`) — lang="vi", tên truy cập cho nút/liên kết (nút chỉ có icon cần aria-label), vùng chạm ≥ 44px, ảnh có alt, ô nhập có nhãn, không emoji. Không dùng axe để khỏi thêm package vào apps/web/package.json (vùng của lead).
- Thứ tự: các file chạy tuần tự theo tên (1 worker). `onboarding.spec.ts` đổi dữ liệu `nguoimoi` nên chỉ chạy được một lần sau mỗi lần seed (global-setup luôn seed lại).

## Trạng thái e2e Giai đoạn 1 (lần chạy 2026-11-11)

| File | Nội dung | Kết quả |
| --- | --- | --- |
| api.spec.ts | 401 khi chưa đăng nhập, Bearer token, hồ sơ người khác không lộ email/vị trí, Zod 400, onboarding < 3 kỹ năng | pass |
| auth.spec.ts | chặn /profile → /login, màn đăng nhập (email; Google khi có AUTH_GOOGLE_ID) + a11y, đăng nhập dev bằng form, nguoimoi → /onboarding | pass |
| onboarding.spec.ts | chọn 2 kỹ năng bị chặn, chọn 3 (aria-pressed), tự đánh giá, thử thách đầu → /profile, quay lại /onboarding bị chuyển đi, a11y | pass |
| profile.spec.ts | tên/handle/thống kê/progressbar, kỹ năng nổi bật + Huyền thoại, không chữ HOA, sang cây kỹ năng, a11y | pass |
| skills.spec.ts (cây) | nút danh mục Sinh tồn + chú giải, tên truy cập có cấp/"chưa mở", yêu cầu cấp 4 + "Gửi xác thực", 404, a11y | pass |
| skills.spec.ts (chi tiết) | 5 cấp + tiêu chí, Hiếm, số liệu, CTA, "Rủi ro cao", ⓘ mở dialog, 404, a11y | pass |
| discover.spec.ts | mục Hiếm nhất/Thịnh hành, bộ lọc danh mục, thứ tự hiếm nhất, tìm kiếm → chi tiết, không kết quả, không lộ vị trí, a11y | pass |

## Ổn định e2e (cổng Giai đoạn 1)

Lead chạy toàn bộ thấy fail không ổn định (discover :14/:24/:37/:48/:60, onboarding :14, skills :88). Phân loại:
- (b) flaky — `next dev` biên dịch route/tRPC lần đầu > 10 s, và test thao tác trước khi React hydrate (gõ ô tìm kiếm, bấm chip/ⓘ bị mất): discover :14/:24/:37/:48, onboarding :14, skills :88. Sửa: global-setup warm-up mọi màn + procedure giai đoạn 1 (webServer chạy trước globalSetup); `gotoScreen` chờ `networkidle`; discover chờ heading "Hiếm nhất" (dữ liệu client) trước khi thao tác; timeout test 90 s, expect 15 s, navigation 60 s, action 20 s.
- (a) test sai — discover :60: ô tìm kiếm cao 23px nhưng nằm trong `<label>` 52px (vùng chạm thật là label) → helper a11y đo label. discover :48: màn trống ghi "Chưa có kỹ năng …" + nút "Đề xuất kỹ năng" — test bám ý nghĩa.
- (c) lỗi UI/API thật: không có.
- Kết quả: 2 lần chạy liên tiếp (lần 1 xóa `.next-e2e`, khởi động lạnh) đều 32/32 pass.

## Giai đoạn 2 — Vòng lặp xác thực

### E2E
| File | Nội dung |
| --- | --- |
| proof-flow.spec.ts (Q2.1) | minhhoang nộp "Thắt nút dây" cấp 4 qua `/proof/new` (video `e2e/fixtures/proof-sample.webm` 21 KB tạo bằng MediaRecorder trong Chromium, mỗi test thêm 32 byte ngẫu nhiên để hash khác nhau) → DB: 3 người được phân công, khóa object không chứa dữ liệu cá nhân → `/proofs/<id>` "0/3 người đã duyệt", `<video>` là presigned (X-Amz-Expires/Signature), bỏ chữ ký → MinIO từ chối → hàng đợi `/review` của người duyệt không có tên người nộp → 3 người đăng nhập dev chấm "Đạt" từng tiêu chí, level giữ 3 cho tới phiếu thứ 3 → proof `passed`, level 4 → `/level-up/<id>` "Lên cấp 4", +XP, "Chia sẻ thành tích" → "Đã sao chép link" → `/share/<id>` công khai, og:image `/og/level-up/...` PNG |
| proof-review-rules.spec.ts (Q2.2) | maianh nộp → `review.task` không chứa user id/handle/tên người nộp, URL video có hạn → người ngoài: `review.task` 403/404, `review.submit` 4xx, `proof.videoUrl` 403, `/review/<id>` 404, không có video → 3 phiếu "Chưa đạt" → `failed`, level giữ 3 → "Chưa đạt cấp 4", không lộ người duyệt → "Kháng nghị" → "Đã gửi kháng nghị", appeal `open`, tải lại "Đang xem xét kháng nghị", hết nút |
| cron.spec.ts (Q2.3) | `POST /api/cron` thiếu/sai secret (Bearer, x-cron-secret) → 401; GET không chạy; đúng secret (cả hai header) → 200 hai lần |

- Test chỉ ĐỌC DB e2e (`e2e/helpers/db.ts`) để tra người được phân công / xác nhận level; mọi thay đổi đi qua ứng dụng.
- Dev server e2e nhận `CRON_SECRET=e2e-cron-secret` (env.ts). Warm-up thêm `/proof/new`, `/review`, `review.queue`.
- Kết quả 2026-11-11: toàn bộ e2e giai đoạn 1+2 (46 test) xanh 2 lần liên tiếp (46/46 trong 3.2 phút và 1.9 phút). Một lần trước đó bị ngắt giữa chừng vì dev server :3200 mất kết nối (ECONNREFUSED sau 12 phút, máy đang tải nặng), không phải lỗi ứng dụng.
- Sửa test không ổn định: onboarding chờ tiêu đề bước đổi / router.push xong thay vì chờ cố định 300 ms; webServer timeout 300 s.

### Rà soát (Q2.4)
| Quy tắc | Kết quả |
| --- | --- |
| finalizeProof là nơi duy nhất ghi level | Đạt: chỉ `packages/domain/src/proofs.ts` (upsert trong finalizeProof, gọi từ submitReview trong cùng tx); appeals.ts overturned mở vòng duyệt mới, không ghi level. |
| Ngưỡng qua app_config | Đạt: review_pass_ratio, reviewer_min_reputation, review_due_hours, reviewer_exclusion_days, media_limits, reputation_deltas. TTL URL ký (15/10 phút) là tham số kỹ thuật trong `packages/api/src/media.ts`. |
| URL video presigned có hạn, bucket private | Đạt (S3Storage presignGet/presignPut + quyền `canViewProofMedia`); e2e xác nhận bỏ chữ ký → 4xx. |
| Payload review không lộ người nộp | Đạt: `review.task` bỏ proofId/mediaKey/người nộp (e2e xác nhận). |
| Cron kiểm secret | Đạt: so sánh SHA-256 + timingSafeEqual, thiếu secret → 401. |
| Không Prisma trong UI | **Vi phạm**: `apps/web/app/proof/new/page.tsx:6-7,19-22` gọi `getConfig(getPrisma(), "media_limits")` ("TẠM") → báo ui + api (cần `proof.limits`). |
| Chấm chấm giữa ở bài level_up (GĐ1 #1) | Đã sửa (`${skill}: lên cấp N`). |
| Quan sát | Sau onboarding 3 kỹ năng, hồ sơ hiện "Kỹ năng 0" (đếm level ≥ 1). Hợp lý nếu chủ ý; ghi lại để lead quyết định. |

## Rà soát code (Q1.4) — 2026-11-11

Đã kiểm tra (grep + đọc code) packages/domain, packages/api, packages/validation, apps/web/app, components, lib:

| Quy tắc | Kết quả |
| --- | --- |
| `user_skills.level` chỉ ghi trong `finalizeProof()` | Đạt. Ghi level duy nhất ở `packages/domain/src/proofs.ts` (finalizeProof, trong `withTx`). `completeOnboarding` tạo user_skills không đặt level (mặc định 0, đúng D1.6). `testing/index.ts` là fixture test. |
| `xp_ledger`, `reputation_events` chỉ INSERT; cache cùng transaction | Đạt (`proofs.ts`: xpLedger.create + users.total_xp/account_level; applyReputation trong tx). Không có update/delete. |
| Không UPDATE `criteria` | Đạt (chỉ seed reset dùng `UPDATE criteria_versions SET source_proposal_id = NULL`). |
| Ngưỡng đọc từ app_config | Đạt: rarity_thresholds, criteria_change_rule, account_level_curve qua getConfig. Ghi chú: cửa sổ thịnh hành 7 ngày (discover.ts) và tối thiểu 3 kỹ năng onboarding (validation) là định nghĩa sản phẩm, chưa có khóa app_config — chấp nhận. |
| Không Prisma/domain trong UI | Đạt: không import `@skillverse/db`/`@skillverse/domain`/getPrisma trong app (ngoài app/api), components, lib (ngoài lib/server). |
| Không emoji | Đạt (mũi tên → chỉ trong chú thích code). |
| aria-label cho nút chỉ có icon | Đạt: IconButton/IconLink bắt buộc `label`; nút Đóng của Sheet, InfoSheet có aria-label. |
| Dữ liệu cá nhân trên URL | Đạt: CTA dùng `/proof/new?skill=<slug>`; đăng nhập dev nhận handle qua body POST. |
| Nhãn HOA / chuỗi chấm giữa (SKILL.md) | 1 lỗi nhỏ — xem bảng dưới. |

### Vi phạm / lỗi đã báo

| # | Mức | File | Vấn đề | Báo |
| --- | --- | --- | --- | --- |
| 1 | nhỏ | packages/domain/src/proofs.ts:446 | Bài level_up `body: "Lên cấp N · <tên>"` dùng chuỗi nối bằng dấu chấm giữa (SKILL.md "Những thứ cần sửa") — nội dung này hiện ở Feed | domain |
| 2 | nhỏ | apps/web/app/(main)/profile/page.tsx (IconLink "Thông báo") | Liên kết tới `/notifications` hiện 404 (chưa có route) | ui |
| 3 | đã xong | apps/web/app/(main)/discover | Màn Khám phá đã dựng; discover.spec.ts pass | ui |
