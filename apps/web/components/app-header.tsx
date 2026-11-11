import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { getServerCaller } from "@/lib/server/trpc";

/** Header trang chính: thương hiệu, tin nhắn, chuông thông báo kèm số chưa đọc. */
export async function AppHeader({ extra }: { extra?: ReactNode }) {
  const api = await getServerCaller();
  const { unreadCount } = await api.notification.list({}).catch(() => ({ unreadCount: 0 }));
  return (
    <header className="flex items-center justify-between px-5 pb-1 pt-4">
      <span className="font-display text-[21px] font-extrabold tracking-[-0.01em]">SkillVerse</span>
      <div className="-mr-2 flex items-center">
        {extra}
        <Link
          href="/messages"
          aria-label="Tin nhắn"
          className="inline-flex size-11 items-center justify-center rounded-[12px] text-text hover:bg-surface-2"
        >
          <MessageCircle size={22} aria-hidden />
        </Link>
        <Link
          href="/notifications"
          aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
          className="relative inline-flex size-11 items-center justify-center rounded-[12px] text-text hover:bg-surface-2"
        >
          <Bell size={22} aria-hidden />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="tabular absolute right-1 top-1 min-w-[18px] rounded-full border-2 border-bg bg-accent px-1 text-center text-[11px] font-bold leading-[14px] text-on-accent"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
