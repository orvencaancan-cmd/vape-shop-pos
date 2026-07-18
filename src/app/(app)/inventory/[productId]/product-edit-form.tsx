"use client";

import { useActionState } from "react";
import { updateProductAction, type ActionState } from "../actions";

const initialState: ActionState = {};

export function ProductEditForm({
  productId,
  name,
  category,
  description,
}: {
  productId: string;
  name: string;
  category: "ejuice" | "accessory";
  description: string | null;
}) {
  const boundAction = updateProductAction.bind(null, productId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Name</span>
        <input
          name="name"
          defaultValue={name}
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Category</span>
        <select
          name="category"
          defaultValue={category}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          <option value="ejuice">E-juice</option>
          <option value="accessory">Accessory</option>
        </select>
      </label>
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
