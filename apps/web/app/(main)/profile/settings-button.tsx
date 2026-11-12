"use client";
import Link from "next/link";
import { ArrowLeftRight, Gavel, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";

const row =
  "-mx-2 flex min-h-12 w-[calc(100%+16px)] items-center gap-3 rounded-[12px] px-2 text-[15px] font-semibold text-text hover:bg-surface-3";

export function SettingsButton({ logout, isEditor }: { logout: () => Promise<void>; isEditor?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label="Cài đặt" icon={Settings} aria-haspopup="dialog" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Cài đặt">
        <div className="flex flex-col pt-2">
          <Link href="/swaps" className={row}>
            <ArrowLeftRight size={20} className="text-muted" aria-hidden />
            Trao đổi kỹ năng
          </Link>
          {isEditor ? (
            <Link href="/admin" className={row}>
              <Gavel size={20} className="text-muted" aria-hidden />
              Quản trị
            </Link>
          ) : null}
          <ThemeToggle className={row} />
          <form action={logout}>
            <button type="submit" className={row}>
              <LogOut size={20} className="text-muted" aria-hidden />
              Đăng xuất
            </button>
          </form>
        </div>
      </Sheet>
    </>
  );
}
