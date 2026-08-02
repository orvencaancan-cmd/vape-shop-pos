"use client";

import { useState } from "react";

export function CollapsibleSection({
  title,
  defaultOpen = false,
  collapsible = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || !collapsible);

  return (
    <section className="mt-4 rounded-xl border border-hairline bg-canvas-soft px-5 py-4">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <h2 className="heading text-lg">{title}</h2>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>
      ) : (
        <h2 className="heading text-lg">{title}</h2>
      )}
      {open && <div className="animate-fade-in-up mt-4 flex flex-wrap gap-4">{children}</div>}
    </section>
  );
}
