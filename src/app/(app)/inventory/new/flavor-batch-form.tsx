"use client";

import { useActionState, useState } from "react";
import { createFlavorBatchAction, type ActionState } from "../actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

const NICOTINE_LEVELS = [3, 6, 12, 24, 36];

export function NewFlavorBatchForm({ brands }: { brands: string[] }) {
  const [state, formAction, pending] = useActionState(createFlavorBatchAction, initialState);
  const [flavorRows, setFlavorRows] = useState<number[]>([0, 1, 2]);
  const [nextRowId, setNextRowId] = useState(3);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <Label>Brand (optional)</Label>
          <Input name="brand" list="brand-suggestions" placeholder="e.g. Naked 100" />
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

      <div>
        <Label>Flavors</Label>
        <p className="mt-1 text-xs text-muted">
          One flavor per line — each becomes its own product.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {flavorRows.map((rowId, i) => (
            <div key={rowId} className="flex items-center gap-2">
              <Input name="flavors" placeholder={`Flavor ${i + 1}`} />
              {flavorRows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setFlavorRows((rows) => rows.filter((r) => r !== rowId))}
                  className="shrink-0 text-xs text-muted hover:text-error"
                  aria-label="Remove flavor"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setFlavorRows((rows) => [...rows, nextRowId]);
            setNextRowId((n) => n + 1);
          }}
          className="mt-2 text-xs text-primary underline underline-offset-2"
        >
          + Add another flavor
        </button>
      </div>

      <div>
        <Label>Nicotine levels</Label>
        <p className="mt-1 text-xs text-muted">
          Every flavor above gets one variant per level checked here.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          {NICOTINE_LEVELS.map((mg) => (
            <label key={mg} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" name="nicotineLevels" value={mg} defaultChecked />
              {mg}mg
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <Label>Cost (per unit)</Label>
          <Input name="cost" type="number" step="0.01" defaultValue={0} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Price (per unit)</Label>
          <Input name="price" type="number" step="0.01" defaultValue={0} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Low stock at</Label>
          <Input name="lowStockThreshold" type="number" defaultValue={5} />
        </label>
      </div>
      <p className="-mt-3 text-xs text-muted">
        Cost, price, and low-stock threshold apply to every variant created — you can adjust
        individual ones afterward.
      </p>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create flavors"}
      </Button>
    </form>
  );
}
