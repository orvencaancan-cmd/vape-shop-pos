"use client";

import { useMemo, useState, useTransition } from "react";
import { recordSaleAction } from "./actions";
import { formatCurrency } from "@/lib/currency";

type Variant = {
  id: string;
  productName: string;
  category: "ejuice" | "accessory";
  label: string;
  price: number;
  stockQty: number;
};

type CartLine = { variantId: string; quantity: number };

export function SellScreen({ variants }: { variants: Variant[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "ejuice" | "accessory">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const variantsById = useMemo(
    () => new Map(variants.map((v) => [v.id, v])),
    [variants],
  );

  const filtered = variants.filter((v) => {
    if (category !== "all" && v.category !== category) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return v.productName.toLowerCase().includes(q) || v.label.toLowerCase().includes(q);
  });

  function addToCart(variantId: string) {
    setMessage(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variantId);
      const variant = variantsById.get(variantId);
      if (!variant) return prev;
      if (existing) {
        if (existing.quantity >= variant.stockQty) return prev;
        return prev.map((l) =>
          l.variantId === variantId ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      if (variant.stockQty <= 0) return prev;
      return [...prev, { variantId, quantity: 1 }];
    });
  }

  function changeQuantity(variantId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const total = cart.reduce((sum, l) => {
    const v = variantsById.get(l.variantId);
    return sum + (v ? v.price * l.quantity : 0);
  }, 0);

  function completeSale() {
    setMessage(null);
    startTransition(async () => {
      const result = await recordSaleAction(cart);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `Sale recorded — ${formatCurrency(total)}` });
        setCart([]);
      }
    });
  }

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          {(["all", "ejuice", "accessory"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                category === c
                  ? "bg-primary text-on-primary"
                  : "bg-canvas-strong text-body hover:text-ink"
              }`}
            >
              {c === "all" ? "All" : c === "ejuice" ? "E-juice" : "Accessories"}
            </button>
          ))}
        </div>

        <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => addToCart(v.id)}
              disabled={v.stockQty <= 0}
              className="flex flex-col items-start rounded-md border border-hairline bg-canvas-soft p-3 text-left transition-shadow hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-sm font-medium text-ink">{v.productName}</span>
              <span className="text-xs text-muted">{v.label}</span>
              <span className="mt-1 text-sm font-semibold text-ink">
                {formatCurrency(v.price)}
              </span>
              <span className="text-xs text-muted">{v.stockQty} in stock</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted">No products match.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-hairline bg-canvas-soft p-4">
        <h2 className="text-sm font-medium text-muted">Cart</h2>
        <div className="mt-3 flex flex-1 flex-col gap-3">
          {cart.length === 0 && <p className="text-sm text-muted">No items yet.</p>}
          {cart.map((l) => {
            const v = variantsById.get(l.variantId);
            if (!v) return null;
            return (
              <div key={l.variantId} className="flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{v.productName}</p>
                  <p className="truncate text-xs text-muted">{v.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeQuantity(l.variantId, -1)}
                    className="h-6 w-6 rounded bg-canvas-strong text-body transition-colors hover:text-ink"
                  >
                    −
                  </button>
                  <span className="text-ink">{l.quantity}</span>
                  <button
                    onClick={() => changeQuantity(l.variantId, 1)}
                    disabled={l.quantity >= v.stockQty}
                    className="h-6 w-6 rounded bg-canvas-strong text-body transition-colors hover:text-ink disabled:opacity-40"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeLine(l.variantId)}
                    className="ml-1 text-xs text-error"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-hairline pt-3">
          <div className="flex items-center justify-between text-sm font-medium text-ink">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <button
            onClick={completeSale}
            disabled={cart.length === 0 || pending}
            className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            {pending ? "Processing…" : "Complete sale"}
          </button>
          {message && (
            <p
              className={`mt-2 text-sm ${
                message.type === "error" ? "text-error" : "text-success"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
