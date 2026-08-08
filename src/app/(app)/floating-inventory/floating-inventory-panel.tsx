"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { variantLabel } from "@/lib/variant-label";
import { groupByBrand } from "@/lib/group-by-brand";
import { matchesSearch } from "@/lib/search-match";
import { addFloatingStockAction, createInventoryTransferAction } from "./actions";
import type { FloatingVariant } from "@/lib/inventory-transfer";
import { PRODUCT_CATEGORIES, ALL_CATEGORIES, categoryLabel } from "@/lib/inventory/product-categories";

type CartLine = { floatingVariantId: string; label: string; available: number; qty: string };

export function FloatingInventoryPanel({
  catalog,
  branches,
  customCategories = [],
}: {
  catalog: FloatingVariant[];
  branches: { shopId: string; shopName: string }[];
  customCategories?: { key: string; label: string }[];
}) {
  const categories = [...ALL_CATEGORIES, ...customCategories.map((c) => c.label)];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [destinationShopId, setDestinationShopId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [addCategory, setAddCategory] = useState<string>("ejuice");
  const [addBrand, setAddBrand] = useState("");
  const [addName, setAddName] = useState("");
  const [addFlavor, setAddFlavor] = useState("");
  const [addNicotine, setAddNicotine] = useState("");
  const [addSize, setAddSize] = useState("");
  const [addForDevice, setAddForDevice] = useState("");
  const [addOhms, setAddOhms] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const filtered = catalog.filter((v) => {
    if (category !== "all" && v.category !== category) return false;
    if (search.trim()) {
      const haystack = `${v.productName} ${v.brand ?? ""} ${v.flavor ?? ""} ${v.category}`;
      if (!matchesSearch(haystack, search)) return false;
    }
    return true;
  });
  const brandGroups = groupByBrand(filtered);

  function addToCart(v: FloatingVariant) {
    setCart((prev) => {
      if (prev.some((l) => l.floatingVariantId === v.id)) return prev;
      const detail = variantLabel({
        flavor: v.flavor,
        nicotine_mg: v.nicotineMg,
        size: v.size,
        for_device: v.forDevice,
        ohms: v.ohms,
      });
      const base = v.brand ? `${v.brand} — ${v.productName}` : v.productName;
      const label = detail === "Default" ? base : `${base} — ${detail}`;
      return [...prev, { floatingVariantId: v.id, label, available: v.stockQty, qty: "" }];
    });
  }

  function updateCartQty(id: string, qty: string) {
    setCart((prev) => prev.map((l) => (l.floatingVariantId === id ? { ...l, qty } : l)));
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((l) => l.floatingVariantId !== id));
  }

  function resetAddForm() {
    setAddBrand("");
    setAddName("");
    setAddFlavor("");
    setAddNicotine("");
    setAddSize("");
    setAddForDevice("");
    setAddOhms("");
    setAddQty("");
    setAddCost("");
    setAddPrice("");
  }

  function submitAddStock() {
    setAddError(null);
    if (!addName.trim()) {
      setAddError("Product name is required");
      return;
    }
    const quantity = Number(addQty);
    if (!addQty.trim() || Number.isNaN(quantity) || quantity <= 0) {
      setAddError("Enter a positive quantity");
      return;
    }
    startTransition(async () => {
      const result = await addFloatingStockAction({
        category: addCategory,
        brand: addBrand.trim() || null,
        productName: addName.trim(),
        flavor: addFlavor.trim() || null,
        nicotineMg: addNicotine.trim() ? Number(addNicotine) : null,
        size: addSize.trim() || null,
        forDevice: addForDevice.trim() || null,
        ohms: addOhms.trim() ? Number(addOhms) : null,
        sku: null,
        quantity,
        cost: addCost.trim() ? Number(addCost) : null,
        price: addPrice.trim() ? Number(addPrice) : null,
      });
      if (result.error) {
        setAddError(result.error);
        return;
      }
      resetAddForm();
      setShowAddForm(false);
      router.refresh();
    });
  }

  function submitTransfer() {
    setMessage(null);
    if (!destinationShopId) {
      setMessage({ type: "error", text: "Pick a destination branch" });
      return;
    }
    const lines = cart
      .map((l) => ({ floatingVariantId: l.floatingVariantId, sentQty: Number(l.qty) }))
      .filter((l) => !Number.isNaN(l.sentQty) && l.sentQty > 0);
    if (lines.length === 0) {
      setMessage({ type: "error", text: "Add at least one item with a quantity" });
      return;
    }
    startTransition(async () => {
      const result = await createInventoryTransferAction(
        "floating",
        null,
        "branch",
        destinationShopId,
        lines,
        note.trim() || null,
      );
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setCart([]);
      setDestinationShopId("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted">Floating inventory</h2>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/floating-inventory/new"
            className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
          >
            Add products
          </Link>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
          >
            {showAddForm ? "Cancel" : "Add stock"}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="animate-fade-in-up mt-3 rounded-lg bg-canvas p-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
            >
              <option value="ejuice">E-juice</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.dbCategory} value={c.dbCategory}>
                  {c.label}
                </option>
              ))}
              {customCategories.map((c) => (
                <option key={c.key} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Brand"
              value={addBrand}
              onChange={(e) => setAddBrand(e.target.value)}
              className="w-36 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <input
              placeholder="Product name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="w-44 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {addCategory === "ejuice" ? (
              <>
                <input
                  placeholder="Flavor"
                  value={addFlavor}
                  onChange={(e) => setAddFlavor(e.target.value)}
                  className="w-32 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Nicotine mg"
                  value={addNicotine}
                  onChange={(e) => setAddNicotine(e.target.value)}
                  className="w-28 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <input
                  placeholder="Size (e.g. 30ml)"
                  value={addSize}
                  onChange={(e) => setAddSize(e.target.value)}
                  className="w-32 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </>
            ) : (
              <>
                <input
                  placeholder="For device (optional)"
                  value={addForDevice}
                  onChange={(e) => setAddForDevice(e.target.value)}
                  className="w-40 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <input
                  placeholder="Variant (color/gauge/flavor)"
                  value={addFlavor}
                  onChange={(e) => setAddFlavor(e.target.value)}
                  className="w-44 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ohms (optional)"
                  value={addOhms}
                  onChange={(e) => setAddOhms(e.target.value)}
                  className="w-28 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="number"
              min={1}
              placeholder="Quantity"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className="w-28 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <input
              type="number"
              step="0.01"
              min={0}
              placeholder="Cost"
              value={addCost}
              onChange={(e) => setAddCost(e.target.value)}
              className="w-28 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <input
              type="number"
              step="0.01"
              min={0}
              placeholder="Price"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              className="w-28 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={submitAddStock}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
            >
              {pending ? "Saving…" : "Add to pool"}
            </button>
          </div>
          {addError && <p className="mt-2 text-xs text-error">{addError}</p>}
        </div>
      )}

      <div className="mt-3">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-hairline bg-canvas-soft px-3 py-2.5 text-sm text-ink shadow-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="scrollbar-thin -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {["all", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${
                category === c ? "bg-primary text-on-primary" : "bg-canvas-strong text-body hover:text-ink"
              }`}
            >
              {c === "all" ? "All" : categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {brandGroups.map((g) => (
          <div key={g.brandKey}>
            <h3 className="text-xs font-medium uppercase text-muted">{g.brandLabel}</h3>
            <div className="mt-1 flex flex-col divide-y divide-hairline">
              {g.items.map((v) => {
                const detail = variantLabel({
                  flavor: v.flavor,
                  nicotine_mg: v.nicotineMg,
                  size: v.size,
                  for_device: v.forDevice,
                  ohms: v.ohms,
                });
                const inCart = cart.some((l) => l.floatingVariantId === v.id);
                return (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 text-ink">
                      {v.productName} — {detail}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{v.stockQty} in stock</span>
                    <span className="shrink-0 text-xs text-muted">{formatCurrency(v.price)}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(v)}
                      disabled={inCart || v.stockQty <= 0}
                      className="shrink-0 rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink disabled:opacity-50"
                    >
                      {inCart ? "Added" : "Add to shipment"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {catalog.length === 0 && <p className="text-sm text-muted">No floating stock yet.</p>}
        {catalog.length > 0 && brandGroups.length === 0 && <p className="text-sm text-muted">No items match.</p>}
      </div>

      {cart.length > 0 && (
        <div className="animate-fade-in-up mt-4 rounded-lg bg-canvas p-3">
          <h3 className="text-xs font-medium text-ink">Shipment</h3>
          <div className="mt-2 flex flex-col divide-y divide-hairline">
            {cart.map((l) => (
              <div key={l.floatingVariantId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 text-ink">{l.label}</span>
                <input
                  type="number"
                  min={1}
                  max={l.available}
                  placeholder="Qty"
                  value={l.qty}
                  onChange={(e) => updateCartQty(l.floatingVariantId, e.target.value)}
                  className="w-20 shrink-0 rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeFromCart(l.floatingVariantId)}
                  className="shrink-0 text-xs text-muted underline underline-offset-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={destinationShopId}
              onChange={(e) => setDestinationShopId(e.target.value)}
              className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
            >
              <option value="">Which branch?</option>
              {branches.map((b) => (
                <option key={b.shopId} value={b.shopId}>
                  {b.shopName}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={submitTransfer}
            disabled={pending}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send to branch"}
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
