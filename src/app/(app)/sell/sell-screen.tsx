"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordSaleAction,
  voidSaleAction,
  searchLoyaltyCustomersAction,
  registerLoyaltyCustomerAction,
  type LoyaltyCustomer,
} from "./actions";
import { formatCurrency } from "@/lib/currency";
import { computePaymentBreakdown } from "@/lib/reports/compute";
import { Stat } from "@/components/ui/stat";

type Variant = {
  id: string;
  productId: string;
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
  discountAmount: number;
  discountReason: string | null;
  saleDiscountAmount: number;
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
  shopName,
  variants: initialVariants,
  recentSales: initialRecentSales,
  currentUserName,
  loyaltyEarnEnabled,
  loyaltyRedeemEnabled,
  loyaltyRewardPercent,
  saleActive,
  salePercent,
  saleScope,
  saleProductIds,
}: {
  shopName: string;
  variants: Variant[];
  recentSales: RecentSale[];
  currentUserName: string | null;
  loyaltyEarnEnabled: boolean;
  loyaltyRedeemEnabled: boolean;
  loyaltyRewardPercent: number;
  saleActive: boolean;
  salePercent: number;
  saleScope: "branch" | "items";
  saleProductIds: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "ejuice" | "accessory">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash");
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [loyaltySearchName, setLoyaltySearchName] = useState("");
  const [loyaltySearchResults, setLoyaltySearchResults] = useState<LoyaltyCustomer[]>([]);
  const [loyaltySearchPending, setLoyaltySearchPending] = useState(false);
  const [loyaltySearchError, setLoyaltySearchError] = useState<string | null>(null);
  const [loyaltyDropdownOpen, setLoyaltyDropdownOpen] = useState(false);
  const [loyaltyShowNewForm, setLoyaltyShowNewForm] = useState(false);
  const [loyaltyNewName, setLoyaltyNewName] = useState("");
  const [loyaltyNewPhone, setLoyaltyNewPhone] = useState("");
  const [loyaltyRegisterPending, setLoyaltyRegisterPending] = useState(false);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<LoyaltyCustomer | null>(null);
  const [loyaltyUseCredit, setLoyaltyUseCredit] = useState(false);
  // Own state rather than deriving straight from props -- a completed sale
  // updates these directly (new stock counts, the new sale prepended) since
  // we already know exactly what changed, instead of re-fetching the whole
  // catalog and today's entire sales list from the server on every sale.
  const [variants, setVariants] = useState<Variant[]>(initialVariants);
  const [recentSales, setRecentSales] = useState<RecentSale[]>(initialRecentSales);

  const variantsById = useMemo(
    () => new Map(variants.map((v) => [v.id, v])),
    [variants],
  );

  const nonVoidedSales = recentSales.filter((s) => !s.voidedAt);
  const paymentBreakdown = computePaymentBreakdown(
    nonVoidedSales.map((s) => ({ total: s.total, payment_method: s.paymentMethod })),
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

  const subtotal = cart.reduce((sum, l) => {
    const v = variantsById.get(l.variantId);
    return sum + (v ? v.price * l.quantity : 0);
  }, 0);

  // Rounded per line, matching exactly how record_sale accumulates the
  // discount server-side (summing first and rounding once can differ by a
  // cent from what actually gets charged).
  const saleProductIdSet = useMemo(() => new Set(saleProductIds), [saleProductIds]);
  function lineSaleDiscount(v: Variant, quantity: number): number {
    if (!saleActive) return 0;
    if (saleScope === "items" && !saleProductIdSet.has(v.productId)) return 0;
    return Math.round(v.price * quantity * (salePercent / 100) * 100) / 100;
  }
  const saleDiscount = cart.reduce((sum, l) => {
    const v = variantsById.get(l.variantId);
    return v ? sum + lineSaleDiscount(v, l.quantity) : sum;
  }, 0);
  const isSaleTransaction = saleActive && saleDiscount > 0;

  const discountValueNum = Number(discountValue) || 0;
  const discountAmount = isSaleTransaction
    ? 0
    : discountMode === "percent"
      ? Math.min(subtotal, Math.round(subtotal * (discountValueNum / 100) * 100) / 100)
      : Math.min(subtotal, discountValueNum);
  const afterDiscount = isSaleTransaction
    ? Math.max(0, subtotal - saleDiscount)
    : Math.max(0, subtotal - discountAmount);

  // Sale, manual Discount, and Loyalty are mutually exclusive -- at most
  // one ever reduces the total, matching record_sale's precedence.
  const loyaltySectionVisible =
    (loyaltyEarnEnabled || loyaltyRedeemEnabled) && !isSaleTransaction && discountAmount === 0;

  const loyaltyRedeemAmount =
    loyaltySectionVisible && loyaltyCustomer?.redeemEnabled && loyaltyUseCredit
      ? Math.min(afterDiscount, loyaltyCustomer.creditBalance)
      : 0;
  const total = Math.max(0, afterDiscount - loyaltyRedeemAmount);
  const loyaltyEarnPreview =
    loyaltySectionVisible && loyaltyEarnEnabled && !loyaltyUseCredit
      ? Math.round(total * (loyaltyRewardPercent / 100) * 100) / 100
      : 0;

  const loyaltySearchSeq = useRef(0);

  useEffect(() => {
    const name = loyaltySearchName.trim();
    const seq = ++loyaltySearchSeq.current;
    const shouldSearch = name !== "" && !loyaltyCustomer && !loyaltyShowNewForm;
    const timer = setTimeout(
      async () => {
        if (seq !== loyaltySearchSeq.current) return;
        if (!shouldSearch) {
          setLoyaltySearchResults([]);
          setLoyaltySearchPending(false);
          return;
        }
        setLoyaltySearchPending(true);
        const result = await searchLoyaltyCustomersAction(name);
        if (seq !== loyaltySearchSeq.current) return;
        setLoyaltySearchPending(false);
        if (result.error) {
          setLoyaltySearchError(result.error);
          setLoyaltySearchResults([]);
          return;
        }
        setLoyaltySearchError(null);
        setLoyaltySearchResults(result.customers ?? []);
      },
      shouldSearch ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [loyaltySearchName, loyaltyCustomer, loyaltyShowNewForm]);

  function selectLoyaltyCustomer(customer: LoyaltyCustomer) {
    setLoyaltyCustomer(customer);
    setLoyaltySearchResults([]);
    setLoyaltyDropdownOpen(false);
    setLoyaltyShowNewForm(false);
    setLoyaltyUseCredit(false);
  }

  async function saveNewLoyaltyCustomer() {
    const name = loyaltyNewName.trim();
    const phone = loyaltyNewPhone.trim();
    if (!name || !phone) return;
    setLoyaltyRegisterPending(true);
    setLoyaltySearchError(null);
    const result = await registerLoyaltyCustomerAction(name, phone);
    setLoyaltyRegisterPending(false);
    if (result.error || !result.customer) {
      setLoyaltySearchError(result.error ?? "Couldn't save that customer");
      return;
    }
    setLoyaltyCustomer(result.customer);
    setLoyaltySearchResults([]);
    setLoyaltyDropdownOpen(false);
    setLoyaltyShowNewForm(false);
    setLoyaltyUseCredit(false);
  }

  function changeLoyaltyCustomer() {
    setLoyaltyCustomer(null);
    setLoyaltyUseCredit(false);
    setLoyaltySearchResults([]);
    setLoyaltyShowNewForm(false);
  }

  function resetLoyalty() {
    setLoyaltySearchName("");
    setLoyaltySearchResults([]);
    setLoyaltySearchError(null);
    setLoyaltyDropdownOpen(false);
    setLoyaltyShowNewForm(false);
    setLoyaltyNewName("");
    setLoyaltyNewPhone("");
    setLoyaltyCustomer(null);
    setLoyaltyUseCredit(false);
  }

  useEffect(() => {
    if (!loyaltySectionVisible) {
      const timer = setTimeout(() => resetLoyalty(), 0);
      return () => clearTimeout(timer);
    }
  }, [loyaltySectionVisible]);

  function completeSale() {
    setMessage(null);
    const soldCart = cart;
    const soldDiscountAmount = isSaleTransaction ? 0 : discountAmount;
    const soldDiscountReason = isSaleTransaction ? null : discountReason.trim() || null;
    const soldSaleDiscountAmount = isSaleTransaction ? saleDiscount : 0;
    const soldPaymentMethod = paymentMethod;
    const soldLoyaltyPhone = loyaltySectionVisible ? (loyaltyCustomer?.phone ?? null) : null;
    const soldLoyaltyName = loyaltySectionVisible ? (loyaltyCustomer?.name ?? null) : null;
    const soldLoyaltyUseCredit = loyaltySectionVisible && loyaltyRedeemAmount > 0;
    startTransition(async () => {
      const result = await recordSaleAction(
        soldCart,
        soldPaymentMethod,
        soldDiscountAmount,
        soldDiscountReason,
        soldLoyaltyPhone,
        soldLoyaltyName,
        soldLoyaltyUseCredit,
      );
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      setMessage({ type: "success", text: `Sale recorded — ${formatCurrency(total)}` });
      setCart([]);
      setPaymentMethod("cash");
      setDiscountValue("");
      setDiscountReason("");
      resetLoyalty();

      // We already know exactly what changed -- update stock and prepend
      // the new sale directly instead of re-fetching everything.
      const soldQuantities = new Map(soldCart.map((l) => [l.variantId, l.quantity]));
      setVariants((prev) =>
        prev.map((v) => {
          const qty = soldQuantities.get(v.id);
          return qty ? { ...v, stockQty: v.stockQty - qty } : v;
        }),
      );
      setRecentSales((prev) => [
        {
          id: result.saleId!,
          total,
          paymentMethod: soldPaymentMethod,
          discountAmount: soldDiscountAmount,
          discountReason: soldDiscountReason,
          saleDiscountAmount: soldSaleDiscountAmount,
          createdAt: new Date().toISOString(),
          createdByName: currentUserName,
          voidedAt: null,
          canVoid: true,
          lines: soldCart.map((l) => {
            const v = variantsById.get(l.variantId);
            return {
              item: v ? `${v.brand ? `${v.brand} — ` : ""}${v.productName} — ${v.label}` : "",
              quantity: l.quantity,
              price: (v?.price ?? 0) * l.quantity,
            };
          }),
        },
        ...prev,
      ]);
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
    <>
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <h1 className="heading text-2xl">{shopName} — Sales</h1>
        {nonVoidedSales.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-4">
            <Stat label="Sales" value={nonVoidedSales.length.toString()} />
            <Stat label="Cash" value={formatCurrency(paymentBreakdown.cash)} />
            <Stat label="GCash" value={formatCurrency(paymentBreakdown.gcash)} />
            <Stat label="Total" value={formatCurrency(paymentBreakdown.total)} />
          </div>
        )}
      </div>
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
        <div className="scrollbar-thin mt-3 flex max-h-56 flex-col gap-3 overflow-y-auto pr-2">
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
          <div className="flex items-center justify-between text-sm text-body">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {isSaleTransaction ? (
            <div className="mt-2 flex items-center justify-between text-sm text-success">
              <span>Sale: {salePercent}% off</span>
              <span>−{formatCurrency(saleDiscount)}</span>
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-center gap-2">
                {(["amount", "percent"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDiscountMode(mode)}
                    disabled={loyaltyUseCredit}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      discountMode === mode
                        ? "bg-primary text-on-primary"
                        : "bg-canvas-strong text-body hover:text-ink"
                    }`}
                  >
                    {mode === "amount" ? "₱" : "%"}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={discountMode === "percent" ? 100 : undefined}
                  placeholder="Discount"
                  value={discountValue}
                  disabled={loyaltyUseCredit}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-24 rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {loyaltyUseCredit && (
                <p className="mt-1 text-xs text-muted">Discount unavailable while using loyalty credit.</p>
              )}
            </>
          )}

          {discountAmount > 0 && (
            <>
              <div className="mt-2 flex items-center justify-between text-sm text-warning">
                <span>Discount</span>
                <span>−{formatCurrency(discountAmount)}</span>
              </div>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className="mt-2 w-full rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </>
          )}

          {(loyaltyEarnEnabled || loyaltyRedeemEnabled) && !loyaltySectionVisible && (
            <p className="mt-3 border-t border-hairline pt-3 text-xs text-muted">
              {isSaleTransaction
                ? "Loyalty paused during Sale."
                : "Loyalty paused — a discount is applied to this sale."}
            </p>
          )}

          {loyaltySectionVisible && (
            <div className="mt-3 border-t border-hairline pt-3">
              <p className="text-xs font-medium uppercase text-muted">Loyalty</p>

              {!loyaltyCustomer && (
                <>
                  <div className="relative mt-2">
                    <input
                      type="text"
                      placeholder="Customer name"
                      value={loyaltySearchName}
                      onChange={(e) => {
                        setLoyaltySearchName(e.target.value);
                        setLoyaltyDropdownOpen(true);
                      }}
                      onFocus={() => setLoyaltyDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setLoyaltyDropdownOpen(false), 150)}
                      className="w-full rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                    />

                    {loyaltyDropdownOpen &&
                      !loyaltyShowNewForm &&
                      loyaltySearchName.trim() !== "" && (
                        <div className="scrollbar-thin absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-hairline bg-canvas shadow-lg">
                          {loyaltySearchPending && (
                            <p className="px-2.5 py-1.5 text-xs text-muted">Searching…</p>
                          )}
                          {!loyaltySearchPending &&
                            loyaltySearchResults.map((c) => (
                              <button
                                key={c.customerId}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectLoyaltyCustomer(c);
                                }}
                                className="block w-full px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-canvas-strong"
                              >
                                {c.name}{" "}
                                <span className="text-xs text-muted">
                                  (•••{c.phone.slice(-4)})
                                </span>
                              </button>
                            ))}
                          {!loyaltySearchPending && loyaltySearchResults.length === 0 && (
                            <p className="px-2.5 py-1.5 text-xs text-muted">No matches.</p>
                          )}
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setLoyaltyNewName(loyaltySearchName.trim());
                              setLoyaltyShowNewForm(true);
                              setLoyaltyDropdownOpen(false);
                            }}
                            className="block w-full border-t border-hairline px-2.5 py-1.5 text-left text-xs text-primary hover:bg-canvas-strong"
                          >
                            + New customer
                            {loyaltySearchName.trim() ? `: "${loyaltySearchName.trim()}"` : ""}
                          </button>
                        </div>
                      )}
                  </div>

                  {loyaltySearchError && (
                    <p className="mt-1.5 text-xs text-error">{loyaltySearchError}</p>
                  )}

                  {loyaltyShowNewForm && (
                    <div className="mt-2 rounded-lg bg-canvas px-2.5 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted">New customer</p>
                        <button
                          type="button"
                          onClick={() => setLoyaltyShowNewForm(false)}
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          Back to search
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Name"
                        value={loyaltyNewName}
                        onChange={(e) => setLoyaltyNewName(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Phone number"
                        value={loyaltyNewPhone}
                        onChange={(e) => setLoyaltyNewPhone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveNewLoyaltyCustomer();
                          }
                        }}
                        className="mt-1.5 w-full rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={saveNewLoyaltyCustomer}
                        disabled={
                          !loyaltyNewName.trim() || !loyaltyNewPhone.trim() || loyaltyRegisterPending
                        }
                        className="mt-2 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
                      >
                        {loyaltyRegisterPending ? "Saving…" : "Save customer"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {loyaltyCustomer && (
                <div className="mt-2 rounded-lg bg-canvas px-2.5 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-ink">{loyaltyCustomer.name}</span>
                      <span className="ml-2 text-xs text-muted">{loyaltyCustomer.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={changeLoyaltyCustomer}
                      className="text-xs text-primary underline underline-offset-2"
                    >
                      Change
                    </button>
                  </div>
                  <p className="mt-1 text-body">
                    Balance: {formatCurrency(loyaltyCustomer.creditBalance)}
                  </p>

                  {loyaltyCustomer.redeemEnabled && loyaltyCustomer.creditBalance > 0 && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-body">
                      <input
                        type="checkbox"
                        checked={loyaltyUseCredit}
                        onChange={(e) => setLoyaltyUseCredit(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      Use credit ({formatCurrency(loyaltyCustomer.creditBalance)})
                    </label>
                  )}
                </div>
              )}

              {loyaltyRedeemAmount > 0 && (
                <div className="mt-2 flex items-center justify-between text-sm text-warning">
                  <span>Loyalty credit used</span>
                  <span>−{formatCurrency(loyaltyRedeemAmount)}</span>
                </div>
              )}
              {loyaltyUseCredit && loyaltyCustomer && loyaltyCustomer.creditBalance > loyaltyRedeemAmount && (
                <p className="mt-1 text-xs text-muted">
                  Balance resets to ₱0.00 — the remaining{" "}
                  {formatCurrency(loyaltyCustomer.creditBalance - loyaltyRedeemAmount)} won&apos;t
                  carry over.
                </p>
              )}
              {loyaltyEarnEnabled && !loyaltyUseCredit && loyaltyEarnPreview > 0 && (
                <p className="mt-1.5 text-xs text-success">
                  This sale will earn {formatCurrency(loyaltyEarnPreview)} credit
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-sm font-medium text-ink">
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
                      {s.discountAmount > 0 && (
                        <span
                          className="ml-2 rounded-full bg-canvas-strong px-2 py-0.5 text-xs text-warning"
                          title={s.discountReason ?? undefined}
                        >
                          −{formatCurrency(s.discountAmount)} off
                        </span>
                      )}
                      {s.saleDiscountAmount > 0 && (
                        <span className="ml-2 rounded-full bg-canvas-strong px-2 py-0.5 text-xs text-success">
                          −{formatCurrency(s.saleDiscountAmount)} sale
                        </span>
                      )}
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
    </>
  );
}
