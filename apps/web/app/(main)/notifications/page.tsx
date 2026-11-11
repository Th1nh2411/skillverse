import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Thông báo" };

/** Tạm thời: danh sách thông báo làm ở giai đoạn sau. */
export default function NotificationsPage() {
  return (
    <main className="flex flex-col gap-4 px-3 pt-3">
      <header className="flex items-center gap-1">
        <BackButton fallback="/profile" />
        <h1 className="font-display text-[22px] font-extrabold">Thông báo</h1>
      </header>
      <div className="px-2">
        <EmptyState icon={BellOff} title="Chưa có thông báo nào" />
      </div>
    </main>
  );
}
