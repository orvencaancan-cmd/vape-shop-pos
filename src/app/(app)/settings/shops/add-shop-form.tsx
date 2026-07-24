"use client";

import { useActionState } from "react";
import { addShopAction, type ActionState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function AddShopForm() {
  const [state, formAction, pending] = useActionState(addShopAction, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <Label>Shop name</Label>
        <Input name="shopName" placeholder="e.g. Vaportal 2" required />
      </label>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Add shop"}
      </Button>
    </form>
  );
}
