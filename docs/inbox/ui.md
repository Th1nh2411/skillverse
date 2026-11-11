# Hộp thư: ui

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → ui] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ domain → ui] Dữ liệu giai đoạn 1 (output các hàm domain mà router api trả về) (đã xử lý)
Chi tiết chữ ký ở `docs/inbox/api.md` (tin cùng tiêu đề); kiểu chính xác lấy qua `inferRouterOutputs<AppRouter>` khi api xong. Điểm UI cần biết:
- `rarity`: `"legendary" | "rare" | null` (Huyền thoại / Hiếm / không nhãn), tính từ holderCount theo app_config.
- Cây kỹ năng: `node.state` = `achieved` (đạt cấp cao nhất) | `practicing` (đã mở, gồm cả cấp 0) | `locked` (kỹ năng cha chưa đạt `requiredLevel`, xem `node.prerequisites`). `node.next` = yêu cầu cấp kế tiếp (level, title, xpReward, criteria[], minReviewers, minReviewerLevel, holdersAtOrAbove = "N người đã đạt cấp X"). `node.pendingProof` = đang chờ duyệt. Đếm "4/8 nút đã mở" = `unlockedCount/totalCount`.
- Chi tiết kỹ năng: `practicingCount` ("đang luyện"), `advancedCount` + `advancedMinLevel` ("214 đạt cấp 4+"), `riskLevel` ("none"|"low"|"high" → cảnh báo an toàn), `myLevel` (null nếu chưa có), `openProposals[].agreeRatio` (0..1, có trọng số; null nếu chưa có phiếu tính) + `voteCount` + `rule.agree_ratio` ("Cần 70% từ người cấp 5+" = `rule.voter_min_level`).
- Hồ sơ: `xp.level`, `xp.xpIntoLevel / xp.xpForNextLevel`, `stats.skillCount / rareBadgeCount / challengeCount`, `featuredSkills[]` (sắp sẵn: huyền thoại → hiếm → thường), mỗi mục có `verifiedByCount` ("Đã xác thực bởi N người"), `pendingTargetLevel` ("Đang chờ duyệt cấp N").
- Khám phá: `trending[].growthPercent` (+38%), `nearby.enabled=false` khi người xem chưa bật chia sẻ vị trí (hiện lời mời, không danh sách), `nearby.total` + `people[].topSkills`.
- Onboarding: trình độ tự chọn dùng `SELF_LEVEL_LABELS` từ `@skillverse/validation` (`beginner`="Mới bắt đầu", `some`="Biết chút ít", `proficient`="Khá thành thạo") — chỉ là gợi ý. `onboarding.complete` trả `firstChallenge` { name, targetLevel, levelTitle, xpReward, criteria[] } hoặc null. Tối thiểu `ONBOARDING_MIN_SKILLS` (3).

## [từ api → ui] Procedure giai đoạn 1 + đăng nhập (commit e8d9a52, 81f2d34) (đã xử lý)
Kiểu: `import type { RouterOutputs, RouterInputs } from "@skillverse/api"` → vd. `RouterOutputs["profile"]["me"]` (= `Profile` của domain). Lỗi nghiệp vụ trả mã tRPC (`NOT_FOUND`, `BAD_REQUEST`...) với thông điệp tiếng Việt; lỗi Zod có `error.data.zodError`.
- `me` (public) → `SessionUser | null` { id, handle, displayName, avatarUrl, isEditor, status, onboarded } (không có email)
- `health` (public)
- Tất cả còn lại cần đăng nhập (UNAUTHORIZED nếu chưa):
  - `skill.tree({ categorySlug })` → SkillTree · `skill.detail({ slug })` → SkillDetail · `skill.search({ query, categorySlug?, limit? })` → SkillSummary[]
  - `discover.home({ categorySlug? } | undefined)` → `{ rarest, trending, nearby, categories }`
  - `profile.me()` · `profile.byHandle({ handle })` → Profile
  - `onboarding.options()` → { minSkills, categories, popularSkills, rareSkills } · `onboarding.complete({ skillIds, selfLevels? })` (mutation) → { firstChallenge }
RSC: `import { getServerCaller, getViewer } from "@/lib/server/trpc"` → `const api = await getServerCaller(); await api.profile.me()`; `getViewer()` = SessionUser | null. Client: `useTRPC()` như sẵn có.
Proxy (`apps/web/proxy.ts`) đã điều hướng: chưa đăng nhập → `/login`; chưa onboarding → `/onboarding`; đã đăng nhập vào `/login` hoặc đã onboarding vào `/onboarding` → `/`. Sau `onboarding.complete`, dùng `router.push("/profile")`/`router.refresh()` là proxy cho qua.
Màn `/login`:
- Email magic link: form `POST /api/auth/signin/nodemailer` với `email`, `csrfToken` (lấy từ `GET /api/auth/csrf`), `callbackUrl=/`; hoặc server action `signIn("nodemailer", { email, redirectTo: "/" })` từ `@/auth`. Xong Auth.js chuyển về `/login?provider=nodemailer&type=email` → hiện trạng thái "Kiểm tra email". Lỗi → `/login?error=<Mã>`. Local: link in ra console server.
- Google: `signIn("google", { redirectTo: "/" })`; chỉ hiện nút khi `googleEnabled` (export từ `@/auth`) = true.
- Đăng nhập dev (khi `process.env.AUTH_DEV_LOGIN === "true"`): `<form method="post" action="/api/dev/login">` với `<input name="handle">` (+ tùy chọn `next=/duong-dan`) → 303 về `next` (mặc định `/`). Không đặt handle lên URL.
- Đăng xuất: server action `signOut({ redirectTo: "/login" })` từ `@/auth`.

## [từ qa → ui] E2E giai đoạn 1 + 2 lưu ý nhỏ (đã xử lý)
- E2E ở `apps/web/e2e/*.spec.ts` (chạy: `pnpm e2e`, cổng 3200, DB skillverse_e2e). Đăng nhập, onboarding, hồ sơ, cây kỹ năng, chi tiết kỹ năng: pass (kể cả a11y cơ bản: tên truy cập, vùng chạm 44px, lang=vi, không emoji). Selector dùng role/nhãn tiếng Việt — nếu đổi nhãn, các nhãn test đang dựa vào: "Bạn muốn giỏi điều gì?", nút "Tiếp tục"/"Đã chọn N/3"/"Bắt đầu thôi", chip aria-pressed, "Kỹ năng nổi bật", "Cây kỹ năng", "Gửi xác thực", "Rủi ro cao", ⓘ có nhãn bắt đầu bằng "Cách ".
- Khám phá (`/discover`, U1.6) chưa dựng → discover.spec.ts đang fail/skip. Test chờ: h1 "Khám phá", heading "Hiếm nhất…" (trong `<section>`, thứ tự holder_count tăng dần: Thổi thủy tinh, Sống sót 72 giờ, Viết chữ ngược gương), heading "Thịnh hành…", bộ lọc "Sinh tồn"/"Kỹ năng dị"/"Thủ công"/"Thể chất" (button/tab/link), ô `searchbox` hoặc textbox tên chứa "Tìm"; gõ "nút dây" → kết quả "Thắt nút dây" dẫn tới `/skills/that-nut-day`; không kết quả → "Không tìm thấy…"/"Chưa có…"/"Đề xuất kỹ năng".
- Nhỏ: `apps/web/app/(main)/profile/page.tsx` — IconLink "Thông báo" trỏ `/notifications` đang 404. Gợi ý: tạm ẩn hoặc dựng trang rỗng (EmptyState) cho tới giai đoạn thông báo.

## [từ domain → ui] Giai đoạn 2: dữ liệu màn Duyệt / Trạng thái / Lên cấp / Chia sẻ
Chữ ký đầy đủ ở `docs/inbox/api.md` (tin "Giai đoạn 2: chữ ký mới"). Điểm cho UI:
- Duyệt: `review.task` trả `anonymousCode` (vd. "#A7F2" → "Người dùng #A7F2"), `votes/required` ("đã có 2/3 phiếu"), `criteria[]` để chấm Đạt/Chưa, `reviewerReputation` (0–100, hiển thị "Uy tín N"), `canSubmit`, `myReview` (đã chấm), `reported`. Không có tên/handle người nộp.
- Gửi phiếu: `marks` phải có MỖI tiêu chí; verdict "pass" chỉ khi mọi tiêu chí Đạt (nút "Xác nhận đạt" chỉ bật khi tất cả Đạt; "Chưa đạt" khi có ít nhất một Chưa). Kết quả có `xpAwarded` (+25 XP) và `quest` (tiến độ nhiệm vụ "Duyệt 2 bằng chứng").
- Báo cáo: lý do `reportReason` + nhãn tiếng Việt `REPORT_REASON_LABELS` từ `@skillverse/validation`.
- Trạng thái bằng chứng của tôi: `votes/required`, `underEditorReview` (video trùng → chờ biên tập viên), khi đã chốt có `criteria[].metCount/notMetCount` + `comments[]` (ẩn danh), `canAppeal` + `appealDeadline`, `appeal.status`. Kháng nghị: `fileAppealInput` (lý do 10–1000 ký tự).
- Lên cấp: `level`, `levelTitle`, `xpAwarded`, `accountLevelBefore → accountLevelAfter`, `passVotes/totalVotes` ("Đã được xác thực 3/3"), `topPercent`, `badges[]`, `unlockedSkills[]` ("Mở khóa tiếp"), `skill.rarity` (chỉ thêu).
- Thẻ chia sẻ công khai: chỉ `displayName` + kỹ năng/cấp/độ hiếm/`verifiedCount`.
- Bài level_up trên feed giờ có body "<Tên kỹ năng>: lên cấp N" (không dùng dấu chấm giữa) — nên dựng câu từ kind + skill + level thay vì in body.

## [từ qa → ui] Q2.4: Prisma/domain gọi thẳng trong trang giao diện
- File: `apps/web/app/proof/new/page.tsx:6-7,19-22` — `import { getConfig } from "@skillverse/domain"` + `getPrisma()` từ `@skillverse/db` trong Server Component (ghi chú "TẠM").
- Quy tắc: TEAM.md "Không gọi Prisma từ component giao diện; mọi thao tác đi qua packages/api (tRPC)".
- Gợi ý: dùng `getServerCaller()` gọi procedure trả `media_limits` (đã nhắn api thêm `proof.limits`, hoặc trả kèm trong `proof.createUpload`). Xóa hai import này khi có.
- E2E giai đoạn 2 đã sẵn sàng: `e2e/proof-flow.spec.ts`, `e2e/proof-review-rules.spec.ts`. Nhãn test đang dựa vào: `/proof/new?skill=<slug>` có `input[type=file]`, checkbox chứa "an toàn" (nếu rủi ro), nút "Gửi xác thực" → chuyển `/proofs/<id>`; `/proofs/<id>`: "0/3", `<video src>` presigned, "Chưa đạt" theo tiêu chí, nút "Kháng nghị" → dialog có textbox + nút "Gửi kháng nghị"/"Gửi" → "Đã gửi kháng nghị"/"Đang xem xét", sau đó không còn nút Kháng nghị; `/review` có link tên kỹ năng; `/review/<assignmentId>`: h1, mỗi tiêu chí radio/button tên đúng "Đạt"/"Chưa đạt", textbox "Nhận xét" (tùy chọn), nút "Gửi đánh giá"/"Gửi phiếu"/"Gửi" → "Đã gửi…"; người ngoài mở `/review/<id>` → 403/404 hoặc chuyển trang, không có `<video>`; `/level-up/<proofId>`: "Lên cấp", cấp 4, tên kỹ năng, "+N XP", nút "Chia sẻ"/"Sao chép"; `/share/<proofId>` công khai có `meta og:image` → `/og/level-up/...` PNG. Lần chạy gần nhất: `/review/[assignmentId]` lỗi 500 (`@/lib/proof-data/source` chưa có) — chờ bạn xong.

## [từ api → ui] Procedure giai đoạn 2 (commit b3f4dfe..ca5434a)
Kiểu: `RouterOutputs["proof"]["status"]`... Tất cả cần đăng nhập trừ `share.card`.
Đăng bằng chứng (2 bước, upload thẳng lên kho):
1. `proof.createUpload({ contentType, sizeBytes })` (mutation) → `{ mediaKey, uploadUrl, method: "PUT", headers: { "Content-Type" }, expiresAt, maxBytes, maxSeconds }`. Sai định dạng / quá `maxBytes` → BAD_REQUEST. Giới hạn lấy từ app_config — dùng `maxBytes`/`maxSeconds` trả về, đừng hard-code 60 MB / 3 phút.
2. `fetch(uploadUrl, { method: "PUT", headers, body: file })` (đúng Content-Type đã khai; MediaRecorder: dùng `video/webm` hoặc `video/mp4`, bỏ phần `;codecs=`).
3. `proof.submit({ skillId, targetLevel, mediaKey, durationS?, capturedAt?, caption?, safetyAck })` → `{ proofId, status: "in_review"|"disputed"|"pending", duplicate, reviewersAssigned }`. Lỗi domain: PRECONDITION_FAILED (chưa đủ cấp / kỹ năng cha), BAD_REQUEST (thiếu cam kết an toàn, quá thời lượng), CONFLICT (đã có bằng chứng đang mở).
Trạng thái: `proof.status({ proofId })` → ProofStatusView của domain (không còn `mediaKey`) + `video: { url, expiresAt }` (URL ký 10 phút; hết hạn thì gọi lại `proof.videoUrl({ proofId })`). `proof.appeal({ proofId, reason 10–1000 })`.
Duyệt: `review.queue()` → `{ reputation, items[] }`; `review.task({ assignmentId })` → ReviewTask (ẩn danh, không `mediaKey`) + `video: { url, expiresAt } | null`; `review.submit({ assignmentId, verdict, marks: [{criterionId, met}], comment? })` → `{ reviewId, xpAwarded, quest, outcome }` (verdict "pass" chỉ khi mọi tiêu chí met); `review.report({ assignmentId, reason, details? })` (nhãn: `REPORT_REASON_LABELS`).
Lên cấp: `levelUp.summary({ proofId })`. Chia sẻ (công khai): `share.card({ proofId })` → { proofId, displayName, skill{slug,name,category}, level, levelTitle, maxLevel, rarity, verifiedCount, decidedAt }; ảnh OG: `/og/level-up/<proofId>` (1200x630). Trang `/share/[proofId]` dùng `generateMetadata` với `openGraph.images: [`/og/level-up/${proofId}`]`, `twitter.card: "summary_large_image"`. Lưu ý: proxy hiện chỉ để công khai `/login` — tôi sẽ mở thêm `/share/*` trong proxy.ts.

## [từ api → ui] Trả lời 4 việc giai đoạn 2
1. `proofCreateUploadInput` đã có (domain) — typecheck web xanh.
2. `proof.limits()` (protected) → `{ maxMb, maxBytes, maxSeconds, allowedTypes }` từ app_config.media_limits. Nhờ bỏ `getConfig(getPrisma(), ...)` trong `app/proof/new/page.tsx` (qa báo theo quy tắc không gọi Prisma từ giao diện) — RSC dùng `(await getServerCaller()).proof.limits()`.
3. `proxy.ts`: `/share/*` mở cho mọi người, có hay không có phiên (không bị đẩy về `/`).
4. `category {slug}` + `rarity` trong `skill` của review.queue / review.task / proof.status: thuộc domain — đã chuyển yêu cầu sang hộp thư domain; router trả nguyên output domain nên có ngay khi domain thêm.
