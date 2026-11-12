"use client";
import { Bookmark, Sprout } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { SavedList } from "./saved-list";

const TABS = [
  { key: "skills", label: "Kỹ năng", Icon: Sprout },
  { key: "saved", label: "Đã lưu", Icon: Bookmark },
] as const;
type Key = (typeof TABS)[number]["key"];

/** Hồ sơ của tôi: "Kỹ năng" | "Đã lưu". Tab lưu trên URL (?tab=saved) để mở lại đúng chỗ. */
export function ProfileTabs({ skills, initial }: { skills: ReactNode; initial: Key }) {
  const [tab, setTab] = useState<Key>(initial);
  const id = useId();
  return (
    <div className="flex flex-col pt-5">
      <div role="tablist" aria-label="Nội dung hồ sơ" className="mx-5 grid grid-cols-2 border-b border-border">
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              role="tab"
              type="button"
              id={`${id}-${key}`}
              aria-selected={on}
              aria-controls={`${id}-panel`}
              onClick={() => {
                setTab(key);
                const u = new URL(window.location.href);
                if (key === "saved") u.searchParams.set("tab", "saved");
                else u.searchParams.delete("tab");
                window.history.replaceState(null, "", u);
              }}
              className={`-mb-px inline-flex min-h-12 items-center justify-center gap-1.5 border-b-2 text-[15px] font-semibold transition-colors ${
                on ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
              }`}
            >
              <Icon size={17} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="pt-1">
        {tab === "skills" ? skills : <SavedList />}
      </div>
    </div>
  );
}
