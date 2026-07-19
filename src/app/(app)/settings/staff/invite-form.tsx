"use client";

import { useActionState } from "react";
import { inviteStaffAction, type ActionState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteStaffAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <Label>Email</Label>
        <Input name="email" type="email" required className="text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <Label>Name (optional)</Label>
        <Input name="displayName" className="text-sm" />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Inviting…" : "Send invite"}
      </Button>
      {state.error && <span className="text-sm text-error">{state.error}</span>}
      {state.success && <span className="text-sm text-success">{state.success}</span>}
    </form>
  );
}
