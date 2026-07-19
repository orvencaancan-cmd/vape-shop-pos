"use client";

import { useActionState, useState } from "react";
import { updateProductAction, type ActionState } from "../actions";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function ProductEditForm({
  productId,
  name,
  brand,
  category,
  subcategory,
  description,
}: {
  productId: string;
  name: string;
  brand: string | null;
  category: "ejuice" | "accessory";
  subcategory: string | null;
  description: string | null;
}) {
  const boundAction = updateProductAction.bind(null, productId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [liveCategory, setLiveCategory] = useState(category);

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
        <Select
          name="category"
          value={liveCategory}
          onChange={(e) => setLiveCategory(e.target.value as "ejuice" | "accessory")}
        >
          <option value="ejuice">E-juice</option>
          <option value="accessory">Accessory</option>
        </Select>
      </label>
      {liveCategory === "accessory" && (
        <label className="flex flex-1 flex-col gap-1.5">
          <Label>Subcategory</Label>
          <Input
            name="subcategory"
            defaultValue={subcategory ?? ""}
            list="subcategory-suggestions"
            placeholder="e.g. Cartridge"
          />
          <datalist id="subcategory-suggestions">
            <option value="Cartridge" />
            <option value="Coil" />
            <option value="Battery" />
          </datalist>
        </label>
      )}
      <label className="flex flex-1 flex-col gap-1.5">
        <Label>Description</Label>
        <Input name="description" defaultValue={description ?? ""} />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
    </form>
  );
}
