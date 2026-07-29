"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSaleAction, voidSaleAction } from "./actions";
import { formatCurrency } from "@/lib/currency";

type Variant = {
  id: string;
  productName: string;
  brand: string | null;
  category: "ejuice" | "accessory";
  label: string;
  price: number;
  stockQty: number;
};

type RecentSale = {
  id: string;
  total: number;
  paymentMethod: "cash" | "gcash";
  createdAt: string;
  createdByName: string | null;
  voidedAt: string | null;
  canVoid: boolean;
  lines: { item: string; quantity: number; price: number }[];
};

type CartLine = { variantId: string; quantity: number };

type BrandGroup = { brandKey: string; brandLabel: string; variants: Variant[] };

const NO_BRAND = "__no_brand__";

const PAYMENT_LABELS: Record<"cash" | "gcash", string> = { cash: "Cash", gcash: "GCash" };

export function SellScreen({
  variants,
  recentSales,
}: {
  variants: Variant[];
  recentSales: RecentSale[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "ejuice" | "accessory">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const variantsById = useMemo(
    () => new Map(variants.map((v) => [v.id, v])),
    [variants],
  );

  const hasActiveFilter = search.trim() !== "" || category !== "all";

  const toggleBrand = (brandKey: string) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandKey)) {
        next.delete(brandKey);
      } else {
        next.add(brandKey);
      }
      return next;
    });
  };

  const filtered = variants.filter((v) => {
    if (category !== "all" && v.category !== category) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return v.productName.toLowerCase().includes(q) || v.label.toLowerCase().includes(q);
  });

  const brandGroupMap = new Map<string, BrandGroup>();
  for (const v of filtered) {
    const brandKey = v.brand ?? NO_BRAND;
    if (!brandGroupMap.has(brandKey)) {
      brandGroupMap.set(brandKey, { brandKey, brandLabel: v.brand ?? "No brand", variants: [] });
    }
    brandGroupMap.get(brandKey)!.variants.push(v);
  }
  const brandGroups = [...brandGroupMap.values()];
  brandGroups.sort((a, b) => {
    if (a.brandKey === NO_BRAND) return 1;
    if (b.brandKey === NO_BRAND) return -1;
    return a.brandLabel.localeCompare(b.brandLabel);
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
      const result = await recordSaleAction(cart, paymentMethod);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `Sale recorded — ${formatCurrency(total)}` });
        setCart([]);
        setPaymentMethod("cash");
        router.refresh();
      }
    });
  }

  function voidSale(saleId: string, saleTotal: number) {
    if (!confirm(`Void this ${formatCurrency(saleTotal)} sale? This restores the stock quantity.`)) {
      return;
    }
    setVoidingId(saleId);
    startTransition(async () => {
      const result = await voidSaleAction(saleId);
      setVoidingId(null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        router.refresh();
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
            className="flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          {(["all", "ejuice", "accessory"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                category === c
                  ? "bg-primary text-on-primary"
                  : "bg-canvas-strong text-body hover:text-ink"
              }`}
            >
              {c === "all" ? "All" : c === "ejuice" ? "E-juice" : "Accessories"}
            </button>
          ))}
        </div>

        <div className="stagger mt-4 flex flex-col gap-4">
          {brandGroups.map((group) => {
            const isExpanded = hasActiveFilter || expandedBrands.has(group.brandKey);
            return (
              <section
                key={group.brandKey}
                className="rounded-xl border border-hairline bg-canvas-soft px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => toggleBrand(group.brandKey)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                  aria-expanded={isExpanded}
                >
                  <h2 className="heading text-base">{group.brandLabel}</h2>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    className={`h-4 w-4 shrink-0 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="animate-fade-in-up mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {group.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => addToCart(v.id)}
                        disabled={v.stockQty <= 0}
                        className="flex flex-col items-start rounded-lg border border-hairline bg-canvas p-3 text-left transition-shadow hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="text-sm font-medium text-ink">{v.productName}</span>
                        <span className="text-xs text-muted">{v.label}</span>
                        <span className="mt-1 text-sm font-semibold text-ink">
                          {formatCurrency(v.price)}
                        </span>
                        <span className="text-xs text-muted">{v.stockQty} in stock</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {brandGroups.length === 0 && <p className="text-sm text-muted">No products match.</p>}
        </div>
      </div>

      <div className="flex flex-col rounded-xl border border-hairline bg-canvas-soft p-4">
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
          <div className="mt-3 flex gap-2">
            {(["cash", "gcash"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  paymentMethod === method
                    ? "bg-primary text-on-primary"
                    : "bg-canvas-strong text-body hover:text-ink"
                }`}
              >
                {PAYMENT_LABELS[method]}
              </button>
            ))}
          </div>
          <button
            onClick={completeSale}
            disabled={cart.length === 0 || pending}
            className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
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

      <div className="md:col-span-3">
        <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
          <h2 className="text-sm font-medium text-muted">Today&apos;s sales</h2>
          {recentSales.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No sales yet today.</p>
          ) : (
            <div className="mt-2 flex flex-col divide-y divide-hairline">
              {recentSales.map((s) => (
                <div key={s.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <span className={s.voidedAt ? "text-muted line-through" : "text-ink"}>
                        {new Date(s.createdAt).toLocaleString()} — {formatCurrency(s.total)}
                      </span>
                      <span className="ml-2 rounded-full bg-canvas-strong px-2 py-0.5 text-xs text-body">
                        {PAYMENT_LABELS[s.paymentMethod]}
                      </span>
                      {s.createdByName && (
                        <span className="ml-2 text-xs text-muted">{s.createdByName}</span>
                      )}
                    </div>
                    {s.voidedAt ? (
                      <span className="rounded-full bg-canvas-strong px-2 py-0.5 text-xs text-muted">
                        Voided
                      </span>
                    ) : s.canVoid ? (
                      <button
                        onClick={() => voidSale(s.id, s.total)}
                        disabled={voidingId === s.id}
                        className="text-xs text-error underline underline-offset-2 disabled:opacity-50"
                      >
                        {voidingId === s.id ? "Voiding…" : "Void"}
                      </button>
                    ) : null}
                  </div>
                  {s.lines.length > 0 && (
                    <ul className="mt-1.5 flex flex-col gap-0.5 pl-1">
                      {s.lines.map((line, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-2 text-xs text-muted"
                        >
                          <span>
                            {line.item} × {line.quantity}
                          </span>
                          <span className="shrink-0">{formatCurrency(line.price)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
