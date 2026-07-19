import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  LabelHTMLAttributes,
} from "react";

const fieldBase =
  "w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...props} />;
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldBase} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} ${className}`} {...props} />;
}

export function Label({
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`text-xs font-medium text-body ${className}`} {...props} />
  );
}
