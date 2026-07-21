import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-active",
  secondary:
    "bg-canvas text-ink border border-hairline hover:bg-canvas-soft",
  ghost: "bg-transparent text-ink hover:bg-canvas-soft",
  danger: "bg-transparent text-error hover:bg-error/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

/**
 * Shared class string so navigation CTAs (rendered as <Link>, not <button>)
 * can look identical to real buttons without nesting an <a> inside a
 * <button> (invalid HTML — two interactive elements).
 */
export function buttonClasses(variant: Variant = "primary", size: Size = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />
  );
}
