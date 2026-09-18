import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-[10px] border border-line bg-white px-3 text-[13.5px] text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-500/10",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-500/10",
        className,
      )}
      {...props}
    />
  );
}

export function NativeSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-[10px] border border-line bg-white px-3 text-[13.5px] text-ink outline-none focus:border-brand focus:ring-4 focus:ring-blue-500/10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
