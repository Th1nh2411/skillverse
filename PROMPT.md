
# SkillVerse — Prompt cho Claude Code (tự chạy, nhiều agent song song)

Gồm 2 phần: **A. Chuẩn bị một lần** (bạn tự làm) và **B. Prompt** (dán cho Claude Code).

---

## A. Chuẩn bị một lần

### A1. Chạy trong môi trường cách ly (bắt buộc khi tắt hỏi quyền)

Chế độ không hỏi quyền cho agent chạy mọi lệnh mà không kiểm tra. Anthropic khuyến cáo chỉ dùng trong môi trường cách ly như container, VM hoặc dev container. Cách dễ nhất:

- Mở dự án trong **VS Code Dev Container** (hoặc một VM / máy ảo riêng), chạy bằng **user thường, không phải root**. Claude Code từ chối chế độ này khi chạy bằng root hoặc `sudo`.
- **Không** để trong môi trường đó: SSH key cá nhân, thông tin đăng nhập cloud của công ty, file `.env` thật của dự án khác.
- `git init` và commit trước khi bắt đầu, để có thể quay lại bất cứ lúc nào.

### A2. Tạo file `.claude/settings.json` ở gốc dự án

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "deny": [
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(./.env)",
      "Read(./.env.local)",
      "Bash(sudo *)",
      "Bash(git push --force *)"
    ]
  }
}
```

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` bật **agent teams**: một agent trưởng (lead) chia việc cho nhiều agent đồng đội (teammate) chạy song song, có danh sách việc chung và nhắn tin cho nhau. Tính năng này đang ở dạng thử nghiệm.
- Các luật `deny` **vẫn có hiệu lực** kể cả khi tắt hỏi quyền. Chúng chặn agent đọc khóa bí mật và chạy lệnh nguy hiểm.

### A3. Khởi động Claude Code

```bash
claude --dangerously-skip-permissions
```

Mọi agent đồng đội tự thừa hưởng chế độ này từ agent trưởng. Lần đầu sẽ có hộp thoại cảnh báo, chọn đồng ý.

**Phương án an toàn hơn** nếu không dùng container: `claude --permission-mode auto`. Gần như không hỏi quyền, nhưng có một mô hình phân loại kiểm tra từng hành động trước khi chạy.

**Mẹo:** chạy trong `tmux` để mỗi agent có một khung riêng trên màn hình (`claude --teammate-mode tmux --dangerously-skip-permissions`). Nếu không, các agent hiện trong bảng ngay dưới ô nhập; dùng phím mũi tên để chọn và xem từng agent.

**Chi phí:** mỗi agent đồng đội là một phiên Claude riêng, nên lượng token dùng tăng theo số agent.

---

## B. Prompt — dán nguyên khối dưới đây cho Claude Code

```text
Bạn là agent trưởng (tech lead) của một nhóm agent. Nhiệm vụ: xây MVP web app "SkillVerse" — mạng xã hội kỹ năng, nơi người dùng lên level bằng bằng chứng video được cộng đồng xác thực — và chuẩn bị sẵn để triển khai demo miễn phí.

## CHẾ ĐỘ LÀM VIỆC: TỰ CHỦ HOÀN TOÀN
- Làm liên tục từ đầu đến cuối tất cả giai đoạn. KHÔNG dừng để hỏi xác nhận giữa các giai đoạn.
- Khi tài liệu không nói rõ: tự chọn phương án đơn giản, an toàn nhất, ghi vào docs/DECISIONS.md rồi làm tiếp.
- Chỉ dừng khi thật sự cần thứ chỉ tôi cung cấp được (tài khoản, khóa API thật). Trước khi dừng, hoàn thành mọi việc làm được mà không cần thứ đó.
- Ghi tiến độ liên tục vào docs/PROGRESS.md (giai đoạn, việc xong, việc đang làm, lỗi còn tồn tại) để tôi xem bất cứ lúc nào.
- Không xóa hay viết lại file trong docs/ (trừ DECISIONS.md, PROGRESS.md, DEPLOY.md) và design/; chỉ thêm.
- Không đẩy code lên remote, không triển khai lên dịch vụ thật, trừ khi tôi đã đặt sẵn thông tin đăng nhập trong môi trường.

## ĐỌC TRƯỚC (nguồn sự thật duy nhất)
1. docs/PRODUCT_BRIEF.md — ý tưởng, 12 màn hình, design tokens
2. docs/DATA_MODEL.md — quy tắc nghiệp vụ BẮT BUỘC
3. db/schema.sql — schema PostgreSQL
4. design/screens/*.html — mockup từng màn hình (390px, tông tối). Bám sát bố cục, màu, font, chữ tiếng Việt.

## KIẾN TRÚC: MONOREPO SẴN SÀNG CHO APP DI ĐỘNG
pnpm workspaces + Turborepo:
- apps/web — Next.js (App Router) + TypeScript strict + Tailwind, PWA, mobile-first
- packages/db — Prisma schema (chuyển từ db/schema.sql, giữ tên bảng/cột bằng @@map/@map), migration, seed, client
- packages/domain — TOÀN BỘ logic nghiệp vụ, thuần TypeScript, không phụ thuộc Next.js: submitProof, assignReviewers, finalizeProof, cập nhật uy tín, báo cáo/xử phạt, đề xuất/bỏ phiếu, độ hiếm, nhiệm vụ ngày
- packages/validation — Zod schema dùng chung cho input/output
- packages/api — tRPC router gọi vào packages/domain; apps/web dùng router này. Sau này app Expo (apps/mobile) gọi chung router.
- Đăng nhập Auth.js (Google + email magic link), hỗ trợ cả session cookie (web) lẫn bearer token (app di động sau này).
- Không gọi Prisma trực tiếp từ component giao diện; mọi thao tác đi qua packages/api.

## CẤU HÌNH DEMO MIỄN PHÍ (mục tiêu triển khai)
- Web: Vercel Hobby. Database: Neon Postgres. Lưu video: Cloudflare R2 (S3 API, presigned URL upload thẳng từ trình duyệt).
- KHÔNG dùng BullMQ/Redis. Tác vụ định kỳ (bằng chứng quá hạn duyệt → gán lại, đóng đề xuất hết hạn, hồi uy tín hằng tuần) chạy trong endpoint POST /api/cron bảo vệ bằng header CRON_SECRET, được gọi mỗi 10 phút bởi GitHub Actions (.github/workflows/cron.yml). Thông báo xử lý ngay trong request.
- Đặt tác vụ nền sau một interface JobRunner trong packages/domain để sau này thay bằng hàng đợi thật mà không sửa logic.
- Video: quay hoặc chọn trên trình duyệt, ưu tiên quay trong app (MediaRecorder, 720p) để chống dùng video cũ; giới hạn 60 MB, 3 phút. Hash = SHA-256 của file (tính ở server sau upload hoặc ở client rồi xác minh). Hash hình ảnh (perceptual) để TODO cho bản chính thức, ghi trong DECISIONS.md. Đây là điểm khác duy nhất so với DATA_MODEL.md.
- Dev local: docker-compose chỉ gồm Postgres và MinIO (thay R2). File .env.example đầy đủ biến.

## QUY TẮC BẮT BUỘC
- UI tiếng Việt, đúng design tokens, font Be Vietnam Pro, icon lucide-react, không emoji, vùng chạm ≥ 44px, aria-label cho nút chỉ có icon.
- user_skills.level CHỈ thay đổi trong finalizeProof(), chạy trong MỘT prisma.$transaction. Không chỗ nào khác ghi level.
- xp_ledger, reputation_events chỉ INSERT; cột tổng trong users là cache, cập nhật cùng transaction.
- Không UPDATE bảng criteria; sửa tiêu chí = tạo criteria_versions mới.
- Mọi ngưỡng đọc từ bảng app_config, không hard-code.
- Validate input bằng Zod, kiểm tra quyền ở server cho mọi thao tác. Không đưa dữ liệu cá nhân lên URL.
- Test: Vitest cho packages/domain (phủ assignReviewers, finalizeProof, uy tín, thu hồi level, bỏ phiếu đề xuất, cả trường hợp hòa phiếu/quá hạn/trùng hash), Playwright cho luồng chính.

## CÁCH TỔ CHỨC NHÓM
Bước 0 — bạn tự làm một mình (không chia việc, vì các phần khác phụ thuộc vào nó): đọc tài liệu, dựng khung monorepo, docker-compose, packages/db (Prisma schema + migration + seed), khung packages/validation và packages/api, layout chung apps/web với thanh điều hướng dưới 5 mục. Commit.

Sau Bước 0, tạo agent team gồm 4 đồng đội, mỗi người SỞ HỮU một vùng thư mục riêng để không ghi đè file của nhau:
1. "domain" — packages/domain + packages/validation + toàn bộ test Vitest. Viết logic nghiệp vụ trước, giao diện gọi vào sau.
2. "api" — packages/api (tRPC router), auth, upload presigned, /api/cron, GitHub Actions cron, next/og cho thẻ chia sẻ.
3. "ui" — apps/web/app và apps/web/components: dựng 12 màn hình bám mockup, nối với router của "api". Khi API chưa xong, dùng dữ liệu giả có kiểu đúng rồi thay sau.
4. "qa" — Playwright e2e, rà soát code theo QUY TẮC BẮT BUỘC và DATA_MODEL.md, báo lỗi cho người sở hữu file thay vì tự sửa file của người khác.

Quy tắc phối hợp:
- Mỗi đồng đội chỉ sửa file trong vùng của mình. Cần thay đổi ở vùng khác → nhắn người sở hữu.
- Khi "domain" thay đổi chữ ký hàm hoặc schema Zod, nhắn ngay cho "api" và "ui".
- Commit nhỏ, thường xuyên, thông điệp rõ ràng; chỉ add file của mình.
- Chia mỗi giai đoạn thành 5–6 việc cho mỗi đồng đội trong danh sách việc chung. Đồng đội xong việc thì tự nhận việc tiếp theo.
- Bạn (lead) không tự viết tính năng khi đồng đội đang làm; bạn điều phối, gộp, chạy kiểm tra, cập nhật PROGRESS.md.

## GIAI ĐOẠN (chạy liên tục; cuối mỗi giai đoạn: lint + typecheck + test phải xanh rồi mới sang giai đoạn sau)
1. Hồ sơ và kỹ năng — Onboarding, Hồ sơ (Main.html), Cây kỹ năng, Chi tiết kỹ năng, Khám phá; độ hiếm từ holder_count.
2. Vòng lặp xác thực (quan trọng nhất) — Đăng bằng chứng, assignReviewers, màn Duyệt (ẩn danh, chấm từng tiêu chí, báo cáo gian lận), finalizeProof, gán lại khi quá hạn qua /api/cron, kháng nghị, màn Lên cấp + thẻ chia sẻ. Playwright: nộp → 3 người duyệt → lên cấp.
3. Xã hội và an toàn — Trang chủ (nhiệm vụ ngày, feed), Thử thách (thử thách tuần, đấu 1v1), báo cáo + trang quản trị tối giản cho biên tập viên (xử phạt, thu hồi level đúng DATA_MODEL.md), Hồ sơ người khác + trao đổi kỹ năng + nhắn tin.
4. Cộng đồng góp ý — Đề xuất kỹ năng mới, bỏ phiếu sửa tiêu chí có trọng số, tạo criteria_versions mới khi thông qua.
5. Sẵn sàng triển khai demo — viết docs/DEPLOY.md: từng bước tạo tài khoản và cấu hình Neon, R2 (CORS cho upload từ trình duyệt), Vercel (biến môi trường, thư mục gốc apps/web), GitHub Actions secret CRON_SECRET; script chạy migration + seed lên Neon; checklist kiểm tra sau triển khai. Build production chạy được cục bộ.

## KẾT THÚC
Khi xong cả 5 giai đoạn: tắt các đồng đội, chạy toàn bộ kiểm tra lần cuối, rồi báo cáo cho tôi ≤ 15 dòng: đã làm gì, cách chạy local, những gì tôi cần tự làm để đưa demo lên mạng (theo DEPLOY.md), và các quyết định quan trọng trong DECISIONS.md.
```
