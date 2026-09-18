import { cn } from "@/lib/utils";
import { Slot } from "./slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "navy";
  size?: "sm" | "md" | "lg" | "icon";
  asChild?: boolean;
  children: ReactNode;
};

const variants: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-[#1d4ed8] active:bg-[#1e40af]",
  secondary:
    "bg-white text-ink border border-line hover:bg-slate-50 shadow-sm",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  success: "bg-emerald text-white hover:bg-[#18a84e] shadow-sm",
  navy: "bg-navy text-white hover:bg-navy-2",
};

const sizes: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-[13.5px] gap-2",
  lg: "h-11 px-5 text-[14px] gap-2",
  icon: "h-9 w-9 p-0",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  asChild,
  children,
  ...props
}: Props) {
  const cls = cn(
    "inline-flex items-center justify-center rounded-[10px] font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    variants[variant],
    sizes[size],
    className,
  );
  if (asChild) {
    return <Slot className={cls}>{children}</Slot>;
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
