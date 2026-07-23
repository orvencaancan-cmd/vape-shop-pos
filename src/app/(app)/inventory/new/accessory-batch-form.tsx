"use client";

import { useActionState, useState } from "react";
import { createAccessoryBatchAction, type ActionState } from "../actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
type ClientSubcategory = {
  key: string;
  label: string;
  listLabel: string;
  listHelp: string;
  variantDimension?:
    | { label: string; inputType: "checklist"; options: { value: string; label: string }[] }
    | { label: string; inputType: "freeText"; placeholder: string };
};

const initialState: ActionState = {};

export function NewAccessoryBatchForm({
  subcategory,
  brands,
  role,
}: {
  subcategory: ClientSubcategory;
  brands: string[];
  role: "owner" | "staff";
}) {
  const [state, formAction, pending] = useActionState(createAccessoryBatchAction, initialState);
  const [rows, setRows] = useState<number[]>([0, 1]);
  const [nextRowId, setNextRowId] = useState(2);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="subcategoryKey" value={subcategory.key} />

      <label className="flex flex-col gap-1.5">
        <Label>Brand (optional)</Label>
        <Input name="brand" list="brand-suggestions" placeholder="e.g. Naked 100" />
        <datalist id="brand-suggestions">
          {brands.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </label>

      <div>
        <Label>{subcategory.listLabel}</Label>
        <p className="mt-1 text-xs text-muted">{subcategory.listHelp}</p>
        <div className="mt-2 flex flex-col gap-2">
          {rows.map((rowId, i) => (
            <div key={rowId} className="flex items-center gap-2">
              <Input name="items" placeholder={`${subcategory.listLabel} ${i + 1}`} />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((x) => x !== rowId))}
                  className="shrink-0 text-xs text-muted hover:text-error"
                  aria-label="Remove row"
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
            setRows((r) => [...r, nextRowId]);
            setNextRowId((n) => n + 1);
          }}
          className="mt-2 text-xs text-primary underline underline-offset-2"
        >
          + Add another
        </button>
      </div>

      {subcategory.variantDimension?.inputType === "checklist" && (
        <div>
          <Label>{subcategory.variantDimension.label}</Label>
          <p className="mt-1 text-xs text-muted">
            Each item listed above gets one variant per option checked here.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            {subcategory.variantDimension.options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" name="variantOptions" value={opt.value} defaultChecked />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {subcategory.variantDimension?.inputType === "freeText" && (
        <label className="flex flex-col gap-1.5">
          <Label>{subcategory.variantDimension.label}</Label>
          <p className="mt-1 text-xs text-muted">
            Each item listed above gets one variant per {subcategory.variantDimension.label.toLowerCase()}
            , separated by commas.
          </p>
          <Input name="variantOptionsText" placeholder={subcategory.variantDimension.placeholder} />
        </label>
      )}

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
        {pending ? "Creating…" : `Create ${subcategory.label.toLowerCase()}`}
      </Button>
    </form>
  );
}
