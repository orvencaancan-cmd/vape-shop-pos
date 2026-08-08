"use client";

import { useActionState } from "react";
import { createFloatingFlavorPodBatchAction, type ActionState } from "../actions";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function NewFloatingFlavorPodBatchForm({ brands }: { brands: string[] }) {
  const [state, formAction, pending] = useActionState(createFloatingFlavorPodBatchAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <Label>Brand</Label>
          <Input name="brand" list="brand-suggestions" placeholder="e.g. Oneo" required />
          <datalist id="brand-suggestions">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>For what device (optional)</Label>
          <Input name="forDevice" placeholder="e.g. Oneo Pod System" />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5">
          <Label>Quantity (each)</Label>
          <Input name="quantity" type="number" min={1} placeholder="e.g. 10" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Cost (per unit)</Label>
          <Input name="cost" type="number" step="0.01" defaultValue={0} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Price (per unit)</Label>
          <Input name="price" type="number" step="0.01" defaultValue={0} />
        </label>
      </div>
      <p className="-mt-3 text-xs text-muted">
        Quantity, cost, and price apply to every flavor created — you can adjust individual ones
        afterward.
      </p>

      <label className="flex flex-col gap-1.5">
        <Label>Flavors</Label>
        <p className="mt-1 text-xs text-muted">
          One flavor per line — each becomes its own product, using the brand, device, cost, and
          price set above.
        </p>
        <Textarea
          name="flavors"
          rows={5}
          placeholder={"Mango Ice\nMint\nWatermelon"}
          className="mt-2"
        />
      </label>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
