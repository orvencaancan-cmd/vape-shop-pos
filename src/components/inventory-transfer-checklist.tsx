"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { variantLabel } from "@/lib/variant-label";
import { ActionButton } from "@/components/action-button";
import {
  saveTransferLineCountAction,
  receiveInventoryTransferAction,
  cancelInventoryTransferAction,
} from "@/app/(app)/floating-inventory/actions";
import type { PendingInventoryTransfer } from "@/lib/inventory-transfer";

function counterpartyLabel(type: "branch" | "floating", name: string | null) {
  return type === "floating" ? "Floating Inventory" : (name ?? "another branch");
}

function lineLabel(l: {
  productName: string;
  brand: string | null;
  flavor: string | null;
  nicotineMg: number | null;
  size: string | null;
  forDevice: string | null;
  ohms: number | null;
}) {
  const detail = variantLabel({
    flavor: l.flavor,
    nicotine_mg: l.nicotineMg,
    size: l.size,
    for_device: l.forDevice,
    ohms: l.ohms,
  });
  const name = l.brand ? `${l.brand} — ${l.productName}` : l.productName;
  return detail === "Default" ? name : `${name} — ${detail}`;
}

function IncomingTransferCard({ transfer }: { transfer: PendingInventoryTransfer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [counts, setCounts] = useState<Map<string, string>>(
    new Map(transfer.lines.filter((l) => l.receivedQty != null).map((l) => [l.id, String(l.receivedQty)])),
  );
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  function saveCount(lineId: string, raw: string) {
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && (value === null || Number.isNaN(value) || value < 0)) return;
    startTransition(async () => {
      const result = await saveTransferLineCountAction(lineId, value);
      if (result.error) setMessage({ type: "error", text: result.error });
    });
  }

  const allCounted = transfer.lines.every((l) => {
    const raw = counts.get(l.id);
    return raw != null && raw.trim() !== "" && !Number.isNaN(Number(raw));
  });

  function receive() {
    setMessage(null);
    startTransition(async () => {
      const result = await receiveInventoryTransferAction(transfer.id);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <h3 className="text-sm font-medium text-ink">
        Incoming from {counterpartyLabel(transfer.sourceType, transfer.sourceShopName)}
      </h3>
      {transfer.note && <p className="mt-1 text-xs text-muted">{transfer.note}</p>}
      <div className="mt-3 flex flex-col divide-y divide-hairline">
        {transfer.lines.map((l) => {
          const raw = counts.get(l.id) ?? "";
          const numeric = raw.trim() === "" ? null : Number(raw);
          const mismatch = numeric != null && !Number.isNaN(numeric) && numeric !== l.sentQty;
          return (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 text-ink">{lineLabel(l)}</span>
              <span className="shrink-0 text-xs text-muted">Sent {l.sentQty}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Counted"
                value={raw}
                onChange={(e) => setCounts((prev) => new Map(prev).set(l.id, e.target.value))}
                onBlur={(e) => saveCount(l.id, e.target.value)}
                className={`w-24 shrink-0 rounded-lg border bg-canvas px-2 py-1 text-sm text-ink placeholder:text-muted focus:outline-none ${
                  mismatch ? "border-warning bg-warning/10" : "border-hairline focus:border-primary"
                }`}
              />
            </div>
          );
        })}
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.type === "error" ? "text-error" : "text-success"}`}>
          {message.text}
        </p>
      )}
      <button
        type="button"
        onClick={receive}
        disabled={!allCounted || pending}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
      >
        {pending ? "Confirming…" : "Confirm receipt"}
      </button>
    </div>
  );
}

export function IncomingInventoryChecklist({ transfers }: { transfers: PendingInventoryTransfer[] }) {
  if (transfers.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {transfers.map((t) => (
        <IncomingTransferCard key={t.id} transfer={t} />
      ))}
    </div>
  );
}

export function OutgoingInventoryList({
  transfers,
  canCancel,
}: {
  transfers: PendingInventoryTransfer[];
  canCancel: boolean;
}) {
  if (transfers.length === 0) return null;
  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <h3 className="text-sm font-medium text-ink">Sent, awaiting receipt</h3>
      <div className="mt-2 flex flex-col divide-y divide-hairline">
        {transfers.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1 text-ink">
              {t.lines.length} item{t.lines.length === 1 ? "" : "s"} to{" "}
              {counterpartyLabel(t.destinationType, t.destinationShopName)}
            </span>
            {canCancel && (
              <ActionButton
                action={cancelInventoryTransferAction.bind(null, t.id)}
                confirmMessage="Cancel this transfer? Nothing has moved yet."
                className="shrink-0 text-xs text-muted underline underline-offset-2"
              >
                Cancel
              </ActionButton>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
