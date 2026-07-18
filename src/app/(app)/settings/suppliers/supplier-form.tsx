"use client";

import { useActionState } from "react";
import { createSupplierAction, updateSupplierAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function SupplierForm({
  supplierId,
  name,
  contactInfo,
}: {
  supplierId?: string;
  name?: string;
  contactInfo?: string | null;
}) {
  const boundAction = supplierId
    ? updateSupplierAction.bind(null, supplierId)
    : createSupplierAction;
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Name</span>
        <input
          name="name"
          defaultValue={name ?? ""}
          required
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Contact (optional)</span>
        <input
          name="contactInfo"
          defaultValue={contactInfo ?? ""}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : supplierId ? "Save" : "Add supplier"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
