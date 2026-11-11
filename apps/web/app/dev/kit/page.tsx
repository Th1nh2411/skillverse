import { notFound } from "next/navigation";
import { Bell, Flame } from "lucide-react";
import { LevelPatch } from "@/components/ui/level-patch";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InfoSheet } from "@/components/ui/sheet";
import { Avatar, EmptyState, ProgressBar } from "@/components/ui/misc";
import { skillIcon } from "@/lib/skill-visual";

/** Trang xem nhanh thành phần nền (chỉ dev). */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const cats = ["sinh-ton", "ky-nang-di", "thu-cong", "the-chat"];
  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 py-6">
      <h1 className="font-display text-[28px] font-extrabold">Bộ thành phần</h1>
      {cats.map((c) => (
        <div key={c} className="flex items-center gap-3">
          <LevelPatch categorySlug={c} rarity="common" level={3} size={64} />
          <LevelPatch categorySlug={c} rarity="rare" level={4} size={64} />
          <LevelPatch categorySlug={c} rarity="legendary" level={5} size={64} />
          <LevelPatch categorySlug={c} rarity="rare" state="practicing" icon={skillIcon("", c)} size={64} />
          <LevelPatch categorySlug={c} state="locked" size={64} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <LevelPatch categorySlug="sinh-ton" rarity="legendary" icon={Flame} size={96} label="Lửa bằng que" />
        <Avatar name="Minh Hoàng" size={64} ring />
        <IconButton label="Thông báo" icon={Bell} />
        <InfoSheet title="Cách tính độ hiếm">Đường chỉ thêu cho biết độ hiếm.</InfoSheet>
      </div>
      <ProgressBar value={2340} max={3000} label="XP" />
      <ProgressBar value={3} max={5} tone="thread" size="sm" label="Cấp" />
      <div className="flex gap-3">
        <Button>Gửi xác thực</Button>
        <Button variant="secondary">Hướng dẫn</Button>
      </div>
      <EmptyState icon={Flame} title="Chưa có kỹ năng nào. Chọn kỹ năng đầu tiên" action={<Button size="md">Chọn kỹ năng</Button>} />
      <p className="font-display text-[22px] font-bold">Kiểm tra dấu: ề ặ ữ ỗ ẫ Nguyễn Thị Huyền</p>
    </main>
  );
}
