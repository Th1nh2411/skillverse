# Triển khai demo miễn phí

Cấu hình: **Vercel Hobby** (web), **Neon** (Postgres), **Cloudflare R2** (video), **GitHub Actions** (cron mỗi 10 phút). Tổng chi phí: 0 đồng trong hạn mức miễn phí.

Thứ tự nên làm: 1 → 2 → 3 → 4 → 5 → 6 → 7. Mỗi bước ghi lại giá trị cần dùng ở bước sau.

---

## 1. Đẩy code lên GitHub

1. Tạo repository **private** trên GitHub (vd. `skillverse`).
2. Tại thư mục dự án:
   ```bash
   git remote add origin git@github.com:<tài-khoản>/skillverse.git
   git push -u origin main
   ```

## 2. Neon — database Postgres

1. Đăng ký tại https://neon.tech (đăng nhập bằng GitHub được).
2. **Create project**: tên `skillverse`, Postgres 16, **region gần Vercel** (vd. *AWS Asia Pacific (Singapore)* nếu dùng Vercel `sin1`).
3. Vào **Connection Details** (nút *Connect*), chọn database `neondb`, lấy hai chuỗi:
   - **Pooled connection** (host có `-pooler`) → dùng làm `DATABASE_URL`.
   - **Direct connection** (tắt "Connection pooling") → dùng làm `DIRECT_URL`.
   Cả hai phải có `?sslmode=require`.
4. Chạy migration + seed dữ liệu demo từ máy của bạn:
   ```bash
   DIRECT_URL="postgresql://...neon.tech/neondb?sslmode=require" \
   DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require" \
   pnpm db:deploy:remote
   ```
   Script (`scripts/deploy-db.sh`) chạy `prisma migrate deploy` rồi seed. Seed tự bỏ qua nếu đã có dữ liệu, nên chạy lại an toàn. Các lần cập nhật schema sau chỉ cần chạy lại lệnh này.

## 3. Cloudflare R2 — lưu video

1. Đăng ký Cloudflare, vào **R2 Object Storage** (cần thêm phương thức thanh toán để mở R2, nhưng gói miễn phí 10 GB không tính tiền).
2. **Create bucket**: tên `skillverse-proofs`, location *Automatic*. **Không** bật Public access (bucket private, video chỉ xem qua URL ký có thời hạn).
3. Ghi lại **Account ID** (trang tổng quan R2). Endpoint S3: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. **Manage R2 API Tokens → Create API token**: quyền *Object Read & Write*, giới hạn vào bucket `skillverse-proofs`. Ghi lại **Access Key ID** và **Secret Access Key** (chỉ hiện một lần).
5. Bucket → **Settings → CORS Policy → Edit**, dán (thay `<domain>` ở bước 4; thêm URL preview nếu cần):
   ```json
   [
     {
       "AllowedOrigins": ["https://<domain>"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Thiếu bước này, trình duyệt sẽ báo lỗi CORS khi tải video lên.

## 4. Vercel — web app

1. Đăng nhập https://vercel.com bằng GitHub → **Add New → Project** → chọn repository `skillverse`.
2. **Root Directory**: `apps/web`. Framework: Next.js (tự nhận). Giữ bật "Include files outside the root directory".
   Lệnh cài và build đã nằm trong `apps/web/vercel.json` (cài ở gốc monorepo, build qua Turborepo để chạy `prisma generate`), không cần sửa ở giao diện.
3. `apps/web/vercel.json` đặt region `sin1`. Nếu Neon ở vùng khác, đổi region cho cùng vùng.
4. **Environment Variables** (áp dụng cho Production và Preview). Đặt **trước** lần build đầu tiên, vì CSP đọc địa chỉ kho video lúc build:

   | Biến | Giá trị |
   | --- | --- |
   | `DATABASE_URL` | Chuỗi Neon **pooled** |
   | `DIRECT_URL` | Chuỗi Neon **direct** |
   | `DATABASE_POOL_MAX` | `5` |
   | `AUTH_SECRET` | Kết quả `openssl rand -base64 32` |
   | `AUTH_URL` | `https://<domain>` (Production; Preview để trống) |
   | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Tùy chọn, xem bước 5 |
   | `EMAIL_SERVER` | SMTP cho magic link, vd. `smtps://resend:<API_KEY>@smtp.resend.com:465` |
   | `EMAIL_FROM` | vd. `SkillVerse <no-reply@<domain-đã-xác-minh>>` |
   | `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
   | `S3_PUBLIC_ENDPOINT` | Giống `S3_ENDPOINT` |
   | `S3_REGION` | `auto` |
   | `S3_BUCKET` | `skillverse-proofs` |
   | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Token R2 ở bước 3 |
   | `CRON_SECRET` | Chuỗi ngẫu nhiên dài (`openssl rand -hex 32`) |
   | `NEXT_PUBLIC_APP_URL` | `https://<domain>` |

   **Không** đặt `AUTH_DEV_LOGIN` ở Production. (Dù đặt nhầm, code vẫn tắt đăng nhập dev khi `VERCEL_ENV=production`.)
   Nếu muốn cho người xem demo đăng nhập nhanh bằng tài khoản seed trên **Preview**, đặt `AUTH_DEV_LOGIN=true` và `AUTH_DEV_LOGIN_ALLOW_PRODUCTION=true` chỉ cho môi trường Preview.
5. **Deploy**. Domain mặc định dạng `skillverse-<xxx>.vercel.app` — đây là `<domain>`. Sau khi có domain: cập nhật `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, CORS R2 (bước 3.5) cho đúng, rồi **Redeploy**.

### Đăng nhập
- **Email magic link**: cần `EMAIL_SERVER` + `EMAIL_FROM`. Cách miễn phí: Resend (3.000 email/tháng), xác minh một domain riêng hoặc dùng địa chỉ thử nghiệm của Resend. Nếu để trống, link đăng nhập chỉ in ra **Vercel → Logs** (dùng tạm được khi tự thử).
- **Google** (tùy chọn): Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (Web application). Authorized redirect URI: `https://<domain>/api/auth/callback/google`. Màn đồng ý OAuth để chế độ *Testing* và thêm email người thử. Nút Google chỉ hiện khi đặt đủ hai biến.

## 5. GitHub Actions — cron mỗi 10 phút

Workflow `.github/workflows/cron.yml` gọi `POST /api/cron` (gán lại bằng chứng quá hạn duyệt, đóng đề xuất hết hạn, hồi uy tín hằng tuần, đóng đấu 1v1).

1. Repository → **Settings → Secrets and variables → Actions**:
   - Tab *Secrets*: `CRON_SECRET` = **cùng giá trị** với Vercel.
   - Tab *Variables*: `APP_URL` = `https://<domain>`.
2. Tab **Actions** → *cron* → **Run workflow** để chạy thử ngay.

Lưu ý: GitHub có thể trễ lịch vài phút, và tự tắt lịch ở repo không có hoạt động trong 60 ngày (bật lại ở tab Actions).

## 6. Checklist sau triển khai

Thay `<domain>` và `$CRON_SECRET`:

- [ ] `https://<domain>/login` mở được, chữ tiếng Việt và font hiển thị đúng.
- [ ] `curl -sI https://<domain>/login | grep -i content-security-policy` có kết quả.
- [ ] `curl -s -o /dev/null -w "%{http_code}" -X POST https://<domain>/api/dev/login` → `404` (đăng nhập dev tắt ở production).
- [ ] `curl -s -o /dev/null -w "%{http_code}" -X POST https://<domain>/api/cron` → `401`.
- [ ] `curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron` → `200` với `"ok":true`.
- [ ] Đăng nhập bằng magic link (hoặc Google) → vào Onboarding, chọn 3 kỹ năng → Hồ sơ.
- [ ] Khám phá, Cây kỹ năng, Chi tiết kỹ năng có dữ liệu seed.
- [ ] Đăng bằng chứng: quay hoặc chọn video ngắn → tải lên không lỗi CORS/CSP (DevTools → Console) → trạng thái "chờ duyệt".
- [ ] GitHub → Actions → *cron* chạy xanh.
- [ ] Mở `https://<domain>/og/level-up/<proofId>` của một bằng chứng đã đạt → ảnh PNG có huy hiệu.

## 7. Thử vòng xác thực trên demo

Seed chỉ có tài khoản email giả (`*@demo.skillverse.local`), không nhận được magic link. Để thử nộp → 3 người duyệt → lên cấp trên bản demo, chọn một trong hai cách:
- Mời 3–4 người thật đăng nhập, mỗi người đạt cấp đủ để duyệt (tài khoản mới chưa đủ cấp duyệt — xem `skill_levels.min_reviewer_level`).
- Hoặc dùng **Preview** với đăng nhập dev bật (bước 4.4) và đăng nhập lần lượt bằng handle seed: `minhhoang`, `quocbao`, `thuha`, `ducanh`, `maianh`, `tuankiet`, `bientap` (biên tập viên).

## Chạy local (nhắc lại)

```bash
pnpm install
cp .env.example .env
pnpm db:up               # Postgres (cổng 5433) + MinIO (9000, console 9001)
pnpm db:deploy && pnpm db:seed
pnpm dev                 # http://localhost:3000
```

Build production cục bộ:
```bash
pnpm build
pnpm --filter @skillverse/web start
```
