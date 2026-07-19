"use client";

import { useActionState, useState } from "react";
import { createProductAction, type ActionState } from "../actions";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function NewProductForm() {
  const [state, formAction, pending] = useActionState(createProductAction, initialState);
  const [category, setCategory] = useState<"ejuice" | "accessory">("ejuice");

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
        <Select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as "ejuice" | "accessory")}
        >
          <option value="ejuice">E-juice</option>
          <option value="accessory">Accessory</option>
        </Select>
      </label>
      {category === "accessory" && (
        <label className="flex flex-col gap-1.5">
          <Label>Subcategory (optional)</Label>
          <Input name="subcategory" list="subcategory-suggestions" placeholder="e.g. Cartridge" />
          <datalist id="subcategory-suggestions">
            <option value="Cartridge" />
            <option value="Coil" />
            <option value="Battery" />
          </datalist>
        </label>
      )}
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
