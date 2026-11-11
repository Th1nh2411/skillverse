import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "lg" | "md" | "sm";

const base =
  "inline-flex select-none items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent font-bold hover:bg-[#f0ad4a] active:bg-[#d8932f]",
  secondary: "bg-surface-3 text-text hover:bg-[#2f4236] active:bg-surface-2",
  ghost: "text-text hover:bg-surface-2 active:bg-surface-3",
  danger: "bg-transparent text-danger border border-danger/50 hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  lg: "min-h-[52px] px-5 text-[15px] rounded-[var(--radius-btn)]",
  md: "min-h-11 px-4 text-sm rounded-[12px]",
  sm: "min-h-11 px-3 text-[13px] rounded-[10px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "lg", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type CommonProps = { variant?: Variant; size?: Size; children: ReactNode; className?: string };

export function Button({
  variant = "primary",
  size = "lg",
  className = "",
  children,
  type = "button",
  ...rest
}: CommonProps & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "lg",
  className = "",
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
