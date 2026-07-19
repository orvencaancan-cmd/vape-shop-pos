"use client";

import { useActionState } from "react";
import { createSupplierAction, updateSupplierAction, type ActionState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
      <label className="flex flex-col gap-1">
        <Label>Name</Label>
        <Input name="name" defaultValue={name ?? ""} required className="text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <Label>Contact (optional)</Label>
        <Input name="contactInfo" defaultValue={contactInfo ?? ""} className="text-sm" />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : supplierId ? "Save" : "Add supplier"}
      </Button>
      {state.error && <span className="text-sm text-error">{state.error}</span>}
    </form>
  );
}
