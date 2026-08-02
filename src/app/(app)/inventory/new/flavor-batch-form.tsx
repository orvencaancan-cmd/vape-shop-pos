"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createFlavorBatchAction, type ActionState } from "../actions";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

const NICOTINE_LEVELS = [3, 6, 12, 24, 36];

export function NewFlavorBatchForm({
  brands,
  suppliers,
  role,
}: {
  brands: string[];
  suppliers: string[];
  role: "owner" | "staff";
}) {
  const [state, formAction, pending] = useActionState(createFlavorBatchAction, initialState);
  const [checkedLevels, setCheckedLevels] = useState<Set<number>>(new Set());

  function toggleLevel(mg: number, checked: boolean) {
    setCheckedLevels((prev) => {
      const next = new Set(prev);
      if (checked) next.add(mg);
      else next.delete(mg);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <Label>Brand</Label>
          <Input name="brand" list="brand-suggestions" placeholder="e.g. Naked 100" required />
          <datalist id="brand-suggestions">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Size (optional, rarely needed)</Label>
          <Input name="size" placeholder="e.g. 30ml — leave blank if it doesn't matter" />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <Label>Supplier (optional)</Label>
        <Input name="supplier" list="supplier-suggestions" placeholder="e.g. Metro Vape Distributors" />
        <datalist id="supplier-suggestions">
          {suppliers.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-muted">
          Used for supplier activity reports later — leave blank if you&apos;re not sure yet.
        </p>
      </label>

      <div>
        <Label>Nicotine levels</Label>
        <p className="mt-1 text-xs text-muted">
          Check every level this brand comes in — each one gets its own cost, price, and flavor
          list below.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          {NICOTINE_LEVELS.map((mg) => (
            <label key={mg} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={checkedLevels.has(mg)}
                onChange={(e) => toggleLevel(mg, e.target.checked)}
              />
              {mg}mg
            </label>
          ))}
        </div>
      </div>

      {checkedLevels.size > 0 && (
        <div className="flex flex-col gap-4">
          {NICOTINE_LEVELS.filter((mg) => checkedLevels.has(mg)).map((mg) => (
            <div key={mg} className="rounded-xl border border-hairline bg-canvas-soft p-4">
              <h3 className="heading text-sm">{mg}mg</h3>
              <div className="mt-3 grid grid-cols-2 gap-4">
                {role === "owner" && (
                  <label className="flex flex-col gap-1.5">
                    <Label>Unit cost</Label>
                    <Input name={`cost-${mg}`} type="number" step="0.01" defaultValue={0} />
                  </label>
                )}
                <label className="flex flex-col gap-1.5">
                  <Label>Price</Label>
                  <Input name={`price-${mg}`} type="number" step="0.01" defaultValue={0} />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-1.5">
                <Label>Flavors</Label>
                <p className="mt-1 text-xs text-muted">
                  One flavor per line — each becomes its own product, sharing the brand and size
                  set above.
                </p>
                <Textarea
                  name={`flavors-${mg}`}
                  rows={4}
                  placeholder={"Blue Razz Ice\nMango Ice\nWatermelon Ice"}
                  className="mt-2"
                />
              </label>
            </div>
          ))}
          <input type="hidden" name="nicotineLevels" value={[...checkedLevels].join(",")} />
        </div>
      )}

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending || checkedLevels.size === 0}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
