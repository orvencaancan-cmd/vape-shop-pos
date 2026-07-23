"use client";

import { useActionState } from "react";
import { createFlavorBatchAction, type ActionState } from "../actions";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

const NICOTINE_LEVELS = [3, 6, 12, 24, 36];

export function NewFlavorBatchForm({
  brands,
  role,
}: {
  brands: string[];
  role: "owner" | "staff";
}) {
  const [state, formAction, pending] = useActionState(createFlavorBatchAction, initialState);

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

      <label className="flex flex-col gap-1.5">
        <Label>Flavors</Label>
        <p className="mt-1 text-xs text-muted">
          One flavor per line — each becomes its own product.
        </p>
        <Textarea
          name="flavors"
          rows={5}
          placeholder={"Blue Razz Ice\nMango Ice\nWatermelon Ice"}
          className="mt-2"
        />
      </label>

      <div>
        <Label>Nicotine levels</Label>
        <p className="mt-1 text-xs text-muted">
          Every flavor above gets one variant per level checked here.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          {NICOTINE_LEVELS.map((mg) => (
            <label key={mg} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" name="nicotineLevels" value={mg} />
              {mg}mg
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {role === "owner" && (
          <label className="flex flex-col gap-1.5">
            <Label>Cost (per unit)</Label>
            <Input name="cost" type="number" step="0.01" defaultValue={0} />
          </label>
        )}
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
        {role === "owner"
          ? "Cost, price, and low-stock threshold apply to every variant created — you can adjust individual ones afterward."
          : "Price and low-stock threshold apply to every variant created — you can adjust individual ones afterward."}
      </p>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create flavors"}
      </Button>
    </form>
  );
}
