"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { THEME_COLOR, THEME_COOKIE, type Theme } from "@/lib/theme";

/** Đổi giao diện tối / sáng ngay trên trang và lưu cookie 1 năm. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  // Đồng bộ sau khi hydrate (server không biết DOM) để tránh lệch hydration.
  useEffect(() => {
    if (document.documentElement.dataset.theme === "light") setTheme("light");
  }, []);
  const next: Theme = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={theme === "light"}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next]);
        setTheme(next);
      }}
      className={className}
    >
      {theme === "light" ? <Sun size={20} className="text-muted" aria-hidden /> : <Moon size={20} className="text-muted" aria-hidden />}
      <span className="flex-1 text-left">Giao diện sáng</span>
      <span
        aria-hidden
        className={`relative h-6 w-10 rounded-full transition-colors ${theme === "light" ? "bg-accent" : "bg-surface-3 outline outline-1 outline-border-strong"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-text transition-transform ${theme === "light" ? "translate-x-[18px] bg-on-accent" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
