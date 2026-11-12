"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, House, Plus, Trophy, User } from "lucide-react";

const items = [
  { href: "/home", label: "Trang chủ", Icon: House },
  { href: "/discover", label: "Khám phá", Icon: Compass },
  { href: "/proof/new", label: "Gửi video", Icon: Plus, primary: true },
  { href: "/challenges", label: "Thử thách", Icon: Trophy },
  { href: "/profile", label: "Hồ sơ", Icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-2 bg-nav pb-[max(env(safe-area-inset-bottom),12px)] pt-2"
    >
      <ul className="mx-auto grid max-w-[560px] grid-cols-5 items-center px-2">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
          if ("primary" in it && it.primary) {
            return (
              <li key={it.href} className="flex justify-center">
                <Link
                  href={it.href}
                  aria-label={it.label}
                  className="flex size-[52px] items-center justify-center rounded-[16px] bg-accent text-on-accent"
                >
                  <it.Icon size={26} strokeWidth={2} aria-hidden />
                </Link>
              </li>
            );
          }
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-[3px] text-[11px] ${
                  active ? "font-semibold text-accent" : "text-muted"
                }`}
              >
                <it.Icon size={22} strokeWidth={2} aria-hidden />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
