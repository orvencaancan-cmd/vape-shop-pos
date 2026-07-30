"use client";

import { useActionState } from "react";
import { createExpenseAction, type ActionState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function ExpenseForm() {
  const [state, formAction, pending] = useActionState(createExpenseAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <Label>Amount</Label>
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          className="w-28 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <Label>Category</Label>
        <Input name="category" placeholder="e.g. Supplies" required className="text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <Label>Note (optional)</Label>
        <Input name="note" className="text-sm" />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Add expense"}
      </Button>
      {state.error && <span className="text-sm text-error">{state.error}</span>}
    </form>
  );
}
