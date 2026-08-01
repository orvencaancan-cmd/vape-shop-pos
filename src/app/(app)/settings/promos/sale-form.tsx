"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateSaleSettingsAction, type SaleSettingsState } from "./actions";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: SaleSettingsState = {};

const NO_BRAND = "__no_brand__";

type Product = { id: string; name: string; brand: string | null };
type BrandGroup = { brandKey: string; brandLabel: string; products: Product[] };

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  // datetime-local wants local time with no offset/seconds -- trim the ISO string.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function BrandCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 accent-primary"
    />
  );
}

export function SaleForm({
  shopId,
  enabled,
  percent,
  scope: initialScope,
  startsAt,
  endsAt,
  products,
  selectedProductIds,
}: {
  shopId: string;
  enabled: boolean;
  percent: number;
  scope: "branch" | "items";
  startsAt: string | null;
  endsAt: string | null;
  products: Product[];
  selectedProductIds: string[];
}) {
  const boundAction = updateSaleSettingsAction.bind(null, shopId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [scope, setScope] = useState(initialScope);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedProductIds));
  // datetime-local gives a timezone-less string ("2026-08-01T14:30"). Parsed
  // here in the browser, `new Date(...)` reads it in the owner's own local
  // timezone -- parsing that same string server-side would read it as UTC
  // instead, silently shifting the sale window. So the visible input stays
  // local-only, and a hidden field carries the already-converted ISO value.
  const [startsAtLocal, setStartsAtLocal] = useState(toDatetimeLocal(startsAt));
  const [endsAtLocal, setEndsAtLocal] = useState(toDatetimeLocal(endsAt));

  const brandGroupMap = new Map<string, BrandGroup>();
  for (const p of products) {
    const brandKey = p.brand ?? NO_BRAND;
    if (!brandGroupMap.has(brandKey)) {
      brandGroupMap.set(brandKey, { brandKey, brandLabel: p.brand ?? "No brand", products: [] });
    }
    brandGroupMap.get(brandKey)!.products.push(p);
  }
  const brandGroups = [...brandGroupMap.values()].sort((a, b) => {
    if (a.brandKey === NO_BRAND) return 1;
    if (b.brandKey === NO_BRAND) return -1;
    return a.brandLabel.localeCompare(b.brandLabel);
  });

  function toggleProduct(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleBrand(group: BrandGroup, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of group.products) {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" name="enabled" defaultChecked={enabled} />
          Sale is on
        </label>
        <label className="flex flex-col gap-1">
          <Label>Percent off</Label>
          <Input
            name="percent"
            type="number"
            step="0.1"
            min={0}
            max={100}
            defaultValue={percent}
            className="w-24 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <Label>Applies to</Label>
          <Select
            name="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as "branch" | "items")}
            className="text-sm"
          >
            <option value="branch">Everything</option>
            <option value="items">Selected products</option>
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <Label>Starts (optional)</Label>
          <Input
            type="datetime-local"
            value={startsAtLocal}
            onChange={(e) => setStartsAtLocal(e.target.value)}
            className="text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <Label>Ends (optional)</Label>
          <Input
            type="datetime-local"
            value={endsAtLocal}
            onChange={(e) => setEndsAtLocal(e.target.value)}
            className="text-sm"
          />
        </label>
        <input
          type="hidden"
          name="startsAt"
          value={startsAtLocal ? new Date(startsAtLocal).toISOString() : ""}
        />
        <input
          type="hidden"
          name="endsAt"
          value={endsAtLocal ? new Date(endsAtLocal).toISOString() : ""}
        />
      </div>
      <p className="-mt-2 text-xs text-muted">
        Leave both dates blank to just turn the sale on/off manually. Set either one to run it on
        a schedule instead.
      </p>

      {scope === "items" && (
        <div className="rounded-lg border border-hairline bg-canvas p-3">
          <p className="text-xs font-medium uppercase text-muted">
            Pick a brand to include all its flavors, or fine-tune individual ones
          </p>
          <div className="mt-2 flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
            {brandGroups.map((group) => {
              const selectedCount = group.products.filter((p) => selected.has(p.id)).length;
              return (
                <div key={group.brandKey}>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <BrandCheckbox
                      checked={selectedCount === group.products.length}
                      indeterminate={selectedCount > 0 && selectedCount < group.products.length}
                      onChange={(checked) => toggleBrand(group, checked)}
                    />
                    {group.brandLabel}
                  </label>
                  <div className="mt-1 ml-5 flex flex-col gap-1">
                    {group.products.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5 text-sm text-body">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={(e) => toggleProduct(p.id, e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {brandGroups.length === 0 && (
              <p className="text-sm text-muted">No products to choose from.</p>
            )}
          </div>
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="productIds" value={id} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.error && <span className="text-sm text-error">{state.error}</span>}
        {state.success && <span className="text-sm text-success">Saved</span>}
      </div>
    </form>
  );
}
