"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { matchesSearch } from "@/lib/search-match";
import { fetchBranchInventoryAction, createInventoryTransferAction, type BranchCatalogItem } from "./actions";

type CartLine = { variantId: string; label: string; available: number; qty: string };

// Lets the owner move stock directly from one branch to another without
// switching into either branch's own /inventory page first -- picks a
// source branch (lazy-fetches its catalog), a destination branch, and
// builds a shipment the same way the floating-pool and pull-back flows
// already do. No schema/RPC changes needed: create_inventory_transfer
// already accepts 'branch' on both ends.
export function BranchTransferPanel({ branches }: { branches: { shopId: string; shopName: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sourceShopId, setSourceShopId] = useState("");
  const [destinationShopId, setDestinationShopId] = useState("");
  const [catalog, setCatalog] = useState<BranchCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function selectSource(shopId: string) {
    setSourceShopId(shopId);
    setCart([]);
    setSearch("");
    setMessage(null);
    if (destinationShopId === shopId) setDestinationShopId("");
    if (!shopId) {
      setCatalog([]);
      return;
    }
    setLoadingCatalog(true);
    const items = await fetchBranchInventoryAction(shopId);
    setCatalog(items);
    setLoadingCatalog(false);
  }

  function addToCart(item: BranchCatalogItem) {
    setCart((prev) => {
      if (prev.some((l) => l.variantId === item.id)) return prev;
      return [...prev, { variantId: item.id, label: item.label, available: item.stockQty, qty: "" }];
    });
  }

  function updateQty(id: string, qty: string) {
    setCart((prev) => prev.map((l) => (l.variantId === id ? { ...l, qty } : l)));
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== id));
  }

  const filtered = catalog.filter((item) => !search.trim() || matchesSearch(item.label, search));

  function submit() {
    setMessage(null);
    if (!sourceShopId || !destinationShopId) {
      setMessage({ type: "error", text: "Pick both a source and destination branch" });
      return;
    }
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
        sourceShopId,
        "branch",
        destinationShopId,
        lines,
        note.trim() || null,
      );
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setSourceShopId("");
      setDestinationShopId("");
      setCatalog([]);
      setCart([]);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <h2 className="text-sm font-medium text-muted">Branch to branch</h2>
      <p className="mt-1 text-xs text-muted">Move stock directly between two branches.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={sourceShopId}
          onChange={(e) => selectSource(e.target.value)}
          className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
        >
          <option value="">From which branch?</option>
          {branches.map((b) => (
            <option key={b.shopId} value={b.shopId}>
              {b.shopName}
            </option>
          ))}
        </select>
        <select
          value={destinationShopId}
          onChange={(e) => setDestinationShopId(e.target.value)}
          disabled={!sourceShopId}
          className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none disabled:opacity-50"
        >
          <option value="">To which branch?</option>
          {branches
            .filter((b) => b.shopId !== sourceShopId)
            .map((b) => (
              <option key={b.shopId} value={b.shopId}>
                {b.shopName}
              </option>
            ))}
        </select>
      </div>

      {sourceShopId && (
        <>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-3 w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-hairline">
            {loadingCatalog ? (
              <p className="px-3 py-2 text-sm text-muted">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">No items match.</p>
            ) : (
              filtered.map((item) => {
                const inCart = cart.some((l) => l.variantId === item.id);
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2 text-sm last:border-0"
                  >
                    <span className="min-w-0 flex-1 text-ink">{item.label}</span>
                    <span className="shrink-0 text-xs text-muted">{item.stockQty} in stock</span>
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      disabled={inCart || item.stockQty <= 0}
                      className="shrink-0 rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink disabled:opacity-50"
                    >
                      {inCart ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {cart.length > 0 && (
        <div className="animate-fade-in-up mt-4 rounded-lg bg-canvas p-3">
          <h3 className="text-xs font-medium text-ink">Shipment</h3>
          <div className="mt-2 flex flex-col divide-y divide-hairline">
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
            disabled={pending || !destinationShopId}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send"}
          </button>
          {message && (
            <p className={`mt-2 text-xs ${message.type === "error" ? "text-error" : "text-success"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
