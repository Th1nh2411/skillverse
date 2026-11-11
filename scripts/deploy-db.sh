#!/usr/bin/env bash
# Chạy migration + seed lên database từ xa (Neon).
# Dùng:  DIRECT_URL="postgresql://...neon.tech/neondb?sslmode=require" \
#        DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require" \
#        pnpm db:deploy:remote
# Biến môi trường đã export luôn được ưu tiên hơn file .env (dotenv không ghi đè).
set -euo pipefail

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "Thiếu DIRECT_URL (chuỗi kết nối DIRECT của Neon, không phải -pooler)." >&2
  exit 1
fi
if [[ "$DIRECT_URL" == *"localhost"* || "$DIRECT_URL" == *"127.0.0.1"* ]]; then
  echo "DIRECT_URL đang trỏ về máy local. Script này dành cho database từ xa." >&2
  exit 1
fi
export DATABASE_URL="${DATABASE_URL:-$DIRECT_URL}"

cd "$(dirname "$0")/../packages/db"
echo "==> prisma migrate deploy"
pnpm exec prisma migrate deploy
echo "==> prisma generate"
pnpm exec prisma generate >/dev/null
echo "==> seed dữ liệu demo (bỏ qua nếu đã có dữ liệu)"
# Seed dùng DIRECT_URL để tránh giới hạn transaction của pooler.
DATABASE_URL="$DIRECT_URL" pnpm exec tsx src/seed.ts
echo "Xong."
