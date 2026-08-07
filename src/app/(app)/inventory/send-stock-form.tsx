"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { variantLabel } from "@/lib/variant-label";
import { matchesSearch } from "@/lib/search-match";
import { createInventoryTransferAction } from "@/app/(app)/floating-inventory/actions";
import type { InventoryVariant } from "./inventory-list";

type CartLine = { variantId: string; label: string; available: number; qty: string };

// Owner-only: sends items from this branch's own catalog either into the
// floating pool (pull-back) or directly to another owned branch, picked
// from one destination dropdown -- createInventoryTransferAction covers
// both since source/destination are just parameters.
export function SendStockForm({
  shopId,
  variants,
  branches,
}: {
  shopId: string;
  variants: InventoryVariant[];
  branches: { shopId: string; shopName: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("floating");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const filtered = variants.filter((v) => {
    if (!search.trim()) return true;
    const haystack = `${v.productName} ${v.brand ?? ""} ${v.flavor ?? ""}`;
    return matchesSearch(haystack, search);
  });

  function addToCart(v: InventoryVariant) {
    setCart((prev) => {
      if (prev.some((l) => l.variantId === v.id)) return prev;
      const detail = variantLabel({
        flavor: v.flavor,
        nicotine_mg: v.nicotineMg,
        size: v.size,
        for_device: v.forDevice,
        ohms: v.ohms,
      });
      const base = v.brand ? `${v.brand} — ${v.productName}` : v.productName;
      const label = detail === "Default" ? base : `${base} — ${detail}`;
      return [...prev, { variantId: v.id, label, available: v.stockQty, qty: "" }];
    });
  }

  function updateQty(id: string, qty: string) {
    setCart((prev) => prev.map((l) => (l.variantId === id ? { ...l, qty } : l)));
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== id));
  }

  function submit() {
    setMessage(null);
    const lines = cart
      .map((l) => ({ variantId: l.variantId, sentQty: Number(l.qty) }))
      .filter((l) => !Number.isNaN(l.sentQty) && l.sentQty > 0);
    if (lines.length === 0) {
      setMessage({ type: "error", text: "Add at least one item with a quantity" });
      return;
    }
    startTransition(async () => {
      const result = await createInventoryTransferAction(
        "branch",
        shopId,
        destination === "floating" ? "floating" : "branch",
        destination === "floating" ? null : destination,
        lines,
        note.trim() || null,
      );
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setCart([]);
      setNote("");
      setSearch("");
      setDestination("floating");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
      >
        Send stock
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">Send stock</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted underline underline-offset-2"
        >
          Close
        </button>
      </div>

      {branches.length > 0 ? (
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
        >
          <option value="floating">Floating inventory</option>
          {branches.map((b) => (
            <option key={b.shopId} value={b.shopId}>
              {b.shopName}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-2 text-xs text-muted">Sending to floating inventory</p>
      )}

      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
      />
      <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-hairline">
        {filtered.slice(0, 50).map((v) => {
          const detail = variantLabel({
            flavor: v.flavor,
            nicotine_mg: v.nicotineMg,
            size: v.size,
            for_device: v.forDevice,
            ohms: v.ohms,
          });
          const inCart = cart.some((l) => l.variantId === v.id);
          return (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2 text-sm last:border-0"
            >
              <span className="min-w-0 flex-1 text-ink">
                {v.brand ? `${v.brand} — ` : ""}
                {v.productName} — {detail}
              </span>
              <span className="shrink-0 text-xs text-muted">{v.stockQty} in stock</span>
              <button
                type="button"
                onClick={() => addToCart(v)}
                disabled={inCart || v.stockQty <= 0}
                className="shrink-0 rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink disabled:opacity-50"
              >
                {inCart ? "Added" : "Add"}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted">No items match.</p>}
      </div>

      {cart.length > 0 && (
        <div className="mt-3 flex flex-col divide-y divide-hairline">
          {cart.map((l) => (
            <div key={l.variantId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 text-ink">{l.label}</span>
              <input
                type="number"
                min={1}
                max={l.available}
                placeholder="Qty"
                value={l.qty}
                onChange={(e) => updateQty(l.variantId, e.target.value)}
                className="w-20 shrink-0 rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeFromCart(l.variantId)}
                className="shrink-0 text-xs text-muted underline underline-offset-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || cart.length === 0}
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send"}
      </button>
      {message && (
        <p className={`mt-2 text-xs ${message.type === "error" ? "text-error" : "text-success"}`}>{message.text}</p>
      )}
    </div>
  );
}
