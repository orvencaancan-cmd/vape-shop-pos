"use client";

import { useState, useTransition } from "react";

/**
 * A button wired to a bound, argument-free server action (e.g.
 * `deleteXAction.bind(null, id)`). Calls it directly via startTransition
 * instead of a <form> submit, and surfaces a returned {error} inline --
 * these actions used to return void, log to the server console only on
 * failure, and leave the UI looking like nothing happened.
 */
export function ActionButton({
  action,
  children,
  className,
  confirmMessage,
  disabled,
  errorClassName = "mt-1 text-xs text-error",
}: {
  action: () => Promise<{ error?: string } | void>;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  disabled?: boolean;
  errorClassName?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={pending || disabled}
        className={className}
        onClick={() => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result && "error" in result && result.error) setError(result.error);
          });
        }}
      >
        {children}
      </button>
      {error && <p className={errorClassName}>{error}</p>}
    </span>
  );
}
