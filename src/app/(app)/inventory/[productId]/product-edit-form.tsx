"use client";

import { useActionState } from "react";
import { updateProductAction, type ActionState } from "../actions";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORIES } from "@/lib/inventory/product-categories";

const initialState: ActionState = {};

export function ProductEditForm({
  productId,
  name,
  brand,
  category,
  description,
  supplier,
  supplierNames,
  customCategories = [],
}: {
  productId: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  supplier: string | null;
  supplierNames: string[];
  customCategories?: { key: string; label: string }[];
}) {
  const boundAction = updateProductAction.bind(null, productId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const knownCategories = ["ejuice", ...PRODUCT_CATEGORIES.map((c) => c.dbCategory), ...customCategories.map((c) => c.label)];

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-1 flex-col gap-1.5">
        <Label>Name</Label>
        <Input name="name" defaultValue={name} required />
      </label>
      <label className="flex flex-1 flex-col gap-1.5">
        <Label>Brand</Label>
        <Input name="brand" defaultValue={brand ?? ""} placeholder="e.g. Naked 100" />
      </label>
      <label className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <Select name="category" defaultValue={category}>
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
          {!knownCategories.includes(category) && <option value={category}>{category}</option>}
        </Select>
      </label>
      <label className="flex flex-1 flex-col gap-1.5">
        <Label>Description</Label>
        <Input name="description" defaultValue={description ?? ""} />
      </label>
      <label className="flex flex-1 flex-col gap-1.5">
        <Label>Supplier</Label>
        <Input
          name="supplier"
          defaultValue={supplier ?? ""}
          list="edit-supplier-suggestions"
          placeholder="e.g. Metro Vape Distributors"
        />
        <datalist id="edit-supplier-suggestions">
          {supplierNames.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
    </form>
  );
}
