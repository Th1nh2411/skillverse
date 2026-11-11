"use client";
import { useId, useState, type ReactNode } from "react";

const TABS = [
  { key: "levels", label: "Cấp độ" },
  { key: "about", label: "Giới thiệu" },
] as const;

export function SkillTabs({ levels, description }: { levels: ReactNode; description: string | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("levels");
  const id = useId();
  return (
    <div className="mt-5 flex flex-col">
      <div role="tablist" aria-label="Nội dung kỹ năng" className="mx-5 grid grid-cols-2 border-b border-border">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`${id}-${t.key}`}
              aria-selected={on}
              aria-controls={`${id}-${t.key}-panel`}
              onClick={() => setTab(t.key)}
              className={`-mb-px min-h-12 border-b-2 text-[14px] font-semibold transition-colors ${
                on ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${id}-${tab}-panel`}
        aria-labelledby={`${id}-${tab}`}
        className="px-2 pt-3"
      >
        {tab === "levels" ? (
          levels
        ) : (
          <p className="px-3 text-[15px] leading-relaxed text-text">{description ?? "Chưa có giới thiệu."}</p>
        )}
      </div>
    </div>
  );
}
