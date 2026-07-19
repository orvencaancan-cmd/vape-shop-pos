import type { HTMLAttributes } from "react";

type Variant = "default" | "primary" | "success" | "warning" | "error";

const variantClasses: Record<Variant, string> = {
  default: "bg-canvas-strong text-body",
  primary: "bg-primary text-on-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
};

export function Badge({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
