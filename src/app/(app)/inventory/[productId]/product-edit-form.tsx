"use client";

import { useActionState, useState } from "react";
import { updateProductAction, type ActionState } from "../actions";

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
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Name</span>
        <input
          name="name"
          defaultValue={name}
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Brand</span>
        <input
          name="brand"
          defaultValue={brand ?? ""}
          placeholder="e.g. Naked 100"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Category</span>
        <select
          name="category"
          value={liveCategory}
          onChange={(e) => setLiveCategory(e.target.value as "ejuice" | "accessory")}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          <option value="ejuice">E-juice</option>
          <option value="accessory">Accessory</option>
        </select>
      </label>
      {liveCategory === "accessory" && (
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Subcategory</span>
          <input
            name="subcategory"
            defaultValue={subcategory ?? ""}
            list="subcategory-suggestions"
            placeholder="e.g. Cartridge"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <datalist id="subcategory-suggestions">
            <option value="Cartridge" />
            <option value="Coil" />
            <option value="Battery" />
          </datalist>
        </label>
      )}
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Description</span>
        <input
          name="description"
          defaultValue={description ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
