"use client";

import { useActionState } from "react";
import { createProductAction, type ActionState } from "../actions";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORIES } from "@/lib/inventory/product-categories";

const initialState: ActionState = {};

export function NewProductForm({ customCategories = [] }: { customCategories?: { key: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createProductAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input name="name" required />
      </label>
      <label className="flex flex-col gap-1.5">
        <Label>Brand (optional)</Label>
        <Input name="brand" placeholder="e.g. Naked 100" />
      </label>
      <label className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <Select name="category" defaultValue="ejuice">
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
        </Select>
      </label>
      <label className="flex flex-col gap-1.5">
        <Label>Description (optional)</Label>
        <Textarea name="description" />
      </label>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create product"}
      </Button>
    </form>
  );
}
