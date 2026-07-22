"use client";

import { useActionState, useRef } from "react";
import { inviteStaffAction, type ActionState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

const ROLE_LABEL: Record<string, string> = {
  staff: "Staff — sell & restock only",
  owner: "Owner — full access including reports, pricing, and billing",
};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteStaffAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
        const role = (form.elements.namedItem("role") as HTMLSelectElement)?.value;
        if (!confirm(`Invite ${email} with ${ROLE_LABEL[role] ?? role} access?`)) {
          e.preventDefault();
        }
      }}
    >
      <label className="flex flex-col gap-1">
        <Label>Email</Label>
        <Input name="email" type="email" required className="text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <Label>Name (optional)</Label>
        <Input name="displayName" className="text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <Label>Access</Label>
        <select
          name="role"
          defaultValue="staff"
          className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink"
        >
          <option value="staff">Staff — sell & restock only</option>
          <option value="owner">Owner — full access</option>
        </select>
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Inviting…" : "Send invite"}
      </Button>
      {state.error && <span className="text-sm text-error">{state.error}</span>}
      {state.success && <span className="text-sm text-success">{state.success}</span>}
    </form>
  );
}
