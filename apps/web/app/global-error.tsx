"use client";

/** Lỗi ở chính layout gốc: tự dựng html tối giản (không dùng được font/token của layout). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          background: "#0e1611",
          color: "#f1eee4",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>Có lỗi xảy ra</h1>
        <p style={{ margin: 0, color: "#a9b5a6" }}>Thử tải lại trang.</p>
        <button
          type="button"
          onClick={reset}
          style={{ minHeight: 52, padding: "0 24px", border: 0, borderRadius: 16, background: "#e9a23b", color: "#1a1406", fontWeight: 700, fontSize: 15 }}
        >
          Thử lại
        </button>
      </body>
    </html>
  );
}
