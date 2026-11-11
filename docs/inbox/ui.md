# Hộp thư: ui

Người khác THÊM tin nhắn vào cuối file (không sửa/xóa tin cũ). Định dạng: `## [từ X → ui] tiêu đề` + nội dung. Chủ hộp thư đánh dấu `(đã xử lý)` sau tiêu đề khi xong.


## [từ domain → ui] Dữ liệu giai đoạn 1 (output các hàm domain mà router api trả về)
Chi tiết chữ ký ở `docs/inbox/api.md` (tin cùng tiêu đề); kiểu chính xác lấy qua `inferRouterOutputs<AppRouter>` khi api xong. Điểm UI cần biết:
- `rarity`: `"legendary" | "rare" | null` (Huyền thoại / Hiếm / không nhãn), tính từ holderCount theo app_config.
- Cây kỹ năng: `node.state` = `achieved` (đạt cấp cao nhất) | `practicing` (đã mở, gồm cả cấp 0) | `locked` (kỹ năng cha chưa đạt `requiredLevel`, xem `node.prerequisites`). `node.next` = yêu cầu cấp kế tiếp (level, title, xpReward, criteria[], minReviewers, minReviewerLevel, holdersAtOrAbove = "N người đã đạt cấp X"). `node.pendingProof` = đang chờ duyệt. Đếm "4/8 nút đã mở" = `unlockedCount/totalCount`.
- Chi tiết kỹ năng: `practicingCount` ("đang luyện"), `advancedCount` + `advancedMinLevel` ("214 đạt cấp 4+"), `riskLevel` ("none"|"low"|"high" → cảnh báo an toàn), `myLevel` (null nếu chưa có), `openProposals[].agreeRatio` (0..1, có trọng số; null nếu chưa có phiếu tính) + `voteCount` + `rule.agree_ratio` ("Cần 70% từ người cấp 5+" = `rule.voter_min_level`).
- Hồ sơ: `xp.level`, `xp.xpIntoLevel / xp.xpForNextLevel`, `stats.skillCount / rareBadgeCount / challengeCount`, `featuredSkills[]` (sắp sẵn: huyền thoại → hiếm → thường), mỗi mục có `verifiedByCount` ("Đã xác thực bởi N người"), `pendingTargetLevel` ("Đang chờ duyệt cấp N").
- Khám phá: `trending[].growthPercent` (+38%), `nearby.enabled=false` khi người xem chưa bật chia sẻ vị trí (hiện lời mời, không danh sách), `nearby.total` + `people[].topSkills`.
- Onboarding: trình độ tự chọn dùng `SELF_LEVEL_LABELS` từ `@skillverse/validation` (`beginner`="Mới bắt đầu", `some`="Biết chút ít", `proficient`="Khá thành thạo") — chỉ là gợi ý. `onboarding.complete` trả `firstChallenge` { name, targetLevel, levelTitle, xpReward, criteria[] } hoặc null. Tối thiểu `ONBOARDING_MIN_SKILLS` (3).

## [từ api → ui] Procedure giai đoạn 1 + đăng nhập (commit e8d9a52, 81f2d34)
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
