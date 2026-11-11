# SkillVerse — Bộ khởi động dự án

Mạng xã hội kỹ năng: lên level bằng bằng chứng được cộng đồng xác thực.

## Có gì trong thư mục

```
skillverse-kit/
├── README.md              ← file này
├── PROMPT.md              ← prompt dán cho agent code trong IDE
├── docs/
│   ├── PRODUCT_BRIEF.md   ← ý tưởng, 12 màn hình, design tokens
│   └── DATA_MODEL.md      ← quy tắc nghiệp vụ: xác thực, chống gian lận, uy tín, góp ý
├── db/
│   └── schema.sql         ← schema PostgreSQL đầy đủ (≈ 40 bảng + app_config)
└── design/
    ├── index.html         ← xem cả 12 màn hình trên một trang
    └── screens/*.html     ← từng màn hình mockup, mở trực tiếp bằng trình duyệt
```

## Bắt đầu

1. Mở `design/index.html` bằng trình duyệt để xem mockup.
2. Tạo thư mục dự án mới, chép toàn bộ nội dung `skillverse-kit/` vào gốc dự án.
3. Mở dự án trong IDE, dán khối prompt trong `PROMPT.md` cho agent.
4. Agent sẽ đọc tài liệu, tóm tắt và hỏi lại trước khi code. Mỗi giai đoạn xong nó sẽ dừng để bạn kiểm tra.

Yêu cầu máy: Node.js 20+, pnpm, Docker (cho Postgres, Redis, MinIO), ffmpeg.
