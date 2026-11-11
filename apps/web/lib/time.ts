/** "vừa xong", "15 phút trước", "3 giờ trước", "2 ngày trước", rồi ngày tháng. */
export function timeAgo(d: Date, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86_400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} ngày trước`;
  return d.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** "Còn 3 ngày", "Còn 5 giờ", "Còn 20 phút", "Đã kết thúc". */
export function timeLeft(d: Date, now = new Date()): string {
  const s = (d.getTime() - now.getTime()) / 1000;
  if (s <= 0) return "Đã kết thúc";
  if (s < 3600) return `Còn ${Math.max(1, Math.floor(s / 60))} phút`;
  if (s < 86_400) return `Còn ${Math.floor(s / 3600)} giờ`;
  return `Còn ${Math.floor(s / 86_400)} ngày`;
}

export function clockTime(d: Date): string {
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
