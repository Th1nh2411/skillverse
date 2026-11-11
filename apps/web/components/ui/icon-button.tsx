import Link from "next/link";
import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";

const cls =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] text-text transition-colors hover:bg-surface-2 active:bg-surface-3";

type Props = {
  /** Bắt buộc: nút chỉ có icon phải có nhãn cho trình đọc màn hình. */
  label: string;
  icon: LucideIcon;
  iconSize?: number;
  className?: string;
};

export function IconButton({
  label,
  icon: Icon,
  iconSize = 22,
  className = "",
  type = "button",
  ...rest
}: Props & Omit<ComponentProps<"button">, "aria-label" | "children" | "className">) {
  return (
    <button type={type} aria-label={label} className={`${cls} ${className}`} {...rest}>
      <Icon size={iconSize} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function IconLink({
  label,
  icon: Icon,
  iconSize = 22,
  className = "",
  ...rest
}: Props & Omit<ComponentProps<typeof Link>, "aria-label" | "children" | "className">) {
  return (
    <Link aria-label={label} className={`${cls} ${className}`} {...rest}>
      <Icon size={iconSize} strokeWidth={2} aria-hidden />
    </Link>
  );
}
