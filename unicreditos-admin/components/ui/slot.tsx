import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Slot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  if (!isValidElement(children)) return <>{children}</>;
  const child = children as ReactElement<{ className?: string }>;
  return cloneElement(child, {
    className: cn(className, child.props.className),
  });
}
