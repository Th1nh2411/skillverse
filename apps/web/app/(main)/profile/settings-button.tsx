"use client";
import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet } from "@/components/ui/sheet";

export function SettingsButton({ logout }: { logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label="Cài đặt" icon={Settings} aria-haspopup="dialog" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Cài đặt">
        <form action={logout} className="pt-2">
          <button
            type="submit"
            className="-mx-2 flex min-h-12 w-[calc(100%+16px)] items-center gap-3 rounded-[12px] px-2 text-[15px] font-semibold text-text hover:bg-surface-3"
          >
            <LogOut size={20} className="text-muted" aria-hidden />
            Đăng xuất
          </button>
        </form>
      </Sheet>
    </>
  );
}
