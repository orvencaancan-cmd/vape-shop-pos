"use client";

import { variantLabel } from "@/lib/variant-label";
import { ActionButton } from "@/components/action-button";
import { resolveShortfallAction } from "./actions";
import type { InventoryTransferShortfall } from "@/lib/inventory-transfer";

function shortfallLabel(s: InventoryTransferShortfall) {
  const detail = variantLabel({
    flavor: s.flavor,
    nicotine_mg: s.nicotineMg,
    size: s.size,
    for_device: s.forDevice,
    ohms: s.ohms,
  });
  const name = s.brand ? `${s.brand} — ${s.productName}` : s.productName;
  return detail === "Default" ? name : `${name} — ${detail}`;
}

export function ShortfallList({ shortfalls }: { shortfalls: InventoryTransferShortfall[] }) {
  if (shortfalls.length === 0) return null;
  return (
    <div className="rounded-xl border border-warning bg-warning/10 p-4">
      <h2 className="text-sm font-medium text-ink">Flagged from short transfers</h2>
      <p className="mt-1 text-xs text-muted">
        Counted short on receipt — the missing units landed here instead of vanishing. Decide where they belong.
      </p>
      <div className="mt-3 flex flex-col divide-y divide-hairline">
        {shortfalls.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <span className="text-ink">{shortfallLabel(s)}</span>
              <span className="ml-2 text-xs text-muted">
                {s.qty} short from {s.sourceType === "floating" ? "floating inventory" : (s.sourceShopName ?? "a branch")}
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              {s.sourceType === "branch" && (
                <ActionButton
                  action={resolveShortfallAction.bind(null, s.id, "return_to_source")}
                  confirmMessage={`Send ${s.qty} back to ${s.sourceShopName ?? "the source branch"}?`}
                  className="rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink"
                >
                  Return to {s.sourceShopName ?? "source"}
                </ActionButton>
              )}
              <ActionButton
                action={resolveShortfallAction.bind(null, s.id, "keep_in_floating")}
                className="rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink"
              >
                Keep in floating
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
