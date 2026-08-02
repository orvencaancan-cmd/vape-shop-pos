"use client";

import { useRouter } from "next/navigation";

// A plain <form action="/reports"> does a real GET navigation, which always
// resets scroll to the top like any fresh page load -- annoying if you're
// deep in the report sections. Submitting through the router instead keeps
// this a client-side transition, so scroll={false}-style position
// preservation applies here too (matching RangeLink/BranchLink).
export function CustomRangeForm({ branch }: { branch?: string }) {
  const router = useRouter();

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const params = new URLSearchParams({ range: "custom" });
        const from = String(form.get("from") ?? "");
        const to = String(form.get("to") ?? "");
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (branch) params.set("branch", branch);
        router.push(`/reports?${params.toString()}`, { scroll: false });
      }}
    >
      <input
        type="date"
        name="from"
        className="rounded border border-hairline bg-canvas px-2 py-1 text-xs text-ink"
      />
      <span className="text-muted">to</span>
      <input
        type="date"
        name="to"
        className="rounded border border-hairline bg-canvas px-2 py-1 text-xs text-ink"
      />
      <button
        type="submit"
        className="rounded bg-primary px-2 py-1 text-xs text-on-primary hover:bg-primary-active"
      >
        Go
      </button>
    </form>
  );
}
