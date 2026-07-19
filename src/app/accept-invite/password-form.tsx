"use client";

import { useActionState } from "react";
import { setPasswordAction, type ActionState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(setPasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <Label>New password</Label>
        <Input name="password" type="password" required />
      </label>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
