import type { HTMLAttributes } from "react";

const paddingClasses = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  padding = "md",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: keyof typeof paddingClasses }) {
  return (
    <div
      className={`rounded-xl border border-hairline bg-canvas-soft ${paddingClasses[padding]} ${className}`}
      {...props}
    />
  );
}
