"use client";

import { useActionState } from "react";
import { createProductAction, type ActionState } from "../actions";

const initialState: ActionState = {};

export function NewProductForm() {
  const [state, formAction, pending] = useActionState(createProductAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Name</span>
        <input
          name="name"
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Brand (optional)</span>
        <input
          name="brand"
          placeholder="e.g. Naked 100"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Category</span>
        <select name="category" className="rounded-md border border-slate-300 px-3 py-2">
          <option value="ejuice">E-juice</option>
          <option value="accessory">Accessory</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Description (optional)</span>
        <textarea
          name="description"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}
