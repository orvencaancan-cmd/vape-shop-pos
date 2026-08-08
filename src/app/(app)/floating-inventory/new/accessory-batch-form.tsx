"use client";

import { useActionState, useState } from "react";
import { createFloatingCategoryBatchAction, type ActionState } from "../actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Dimension =
  | { label: string; inputType: "checklist"; options: { value: string; label: string }[] }
  | { label: string; inputType: "freeText"; placeholder: string };

type ClientCategory = {
  key: string;
  label: string;
  listLabel: string;
  listHelp: string;
  variantDimension?: Dimension;
  variantDimension2?: Dimension;
};

const initialState: ActionState = {};

export function NewFloatingAccessoryBatchForm({
  category,
  brands,
}: {
  category: ClientCategory;
  brands: string[];
}) {
  const [state, formAction, pending] = useActionState(createFloatingCategoryBatchAction, initialState);
  const [rows, setRows] = useState<number[]>([0, 1]);
  const [nextRowId, setNextRowId] = useState(2);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="categoryKey" value={category.key} />

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
        <Label>{category.listLabel}</Label>
        <p className="mt-1 text-xs text-muted">{category.listHelp}</p>
        <div className="mt-2 flex flex-col gap-2">
          {rows.map((rowId, i) => (
            <div key={rowId} className="flex items-center gap-2">
              <Input name="items" placeholder={`${category.listLabel} ${i + 1}`} />
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

      {category.variantDimension?.inputType === "checklist" && (
        <div>
          <Label>{category.variantDimension.label}</Label>
          <p className="mt-1 text-xs text-muted">
            Each item listed above gets one variant per option checked here.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            {category.variantDimension.options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" name="variantOptions" value={opt.value} defaultChecked />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {category.variantDimension?.inputType === "freeText" && (
        <label className="flex flex-col gap-1.5">
          <Label>{category.variantDimension.label}</Label>
          <p className="mt-1 text-xs text-muted">
            Each item listed above gets one variant per {category.variantDimension.label.toLowerCase()}
            , separated by commas.
          </p>
          <Input name="variantOptionsText" placeholder={category.variantDimension.placeholder} />
        </label>
      )}

      {category.variantDimension2?.inputType === "checklist" && (
        <div>
          <Label>{category.variantDimension2.label}</Label>
          <p className="mt-1 text-xs text-muted">
            Each combination above also gets one variant per option checked here.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            {category.variantDimension2.options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" name="variantOptions2" value={opt.value} defaultChecked />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {category.variantDimension2?.inputType === "freeText" && (
        <label className="flex flex-col gap-1.5">
          <Label>{category.variantDimension2.label}</Label>
          <p className="mt-1 text-xs text-muted">
            Each combination above also gets one variant per {category.variantDimension2.label.toLowerCase()}
            , separated by commas.
          </p>
          <Input name="variantOptionsText2" placeholder={category.variantDimension2.placeholder} />
        </label>
      )}

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
        Quantity, cost, and price apply to every variant created — you can adjust individual ones
        afterward.
      </p>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : `Create ${category.label.toLowerCase()}`}
      </Button>
    </form>
  );
}
