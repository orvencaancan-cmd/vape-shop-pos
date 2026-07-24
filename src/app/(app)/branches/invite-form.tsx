"use client";

import { useActionState } from "react";
import { inviteStaffAction, type ActionState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

const initialState: ActionState = {};

const ROLE_LABEL: Record<string, string> = {
  staff: "Staff — sell & restock only",
  owner: "Owner — full access including reports, pricing, and billing",
};

export function InviteForm({ shops }: { shops: ShopMembership[] }) {
  const [state, formAction, pending] = useActionState(inviteStaffAction, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
        const role = (form.elements.namedItem("role") as HTMLSelectElement)?.value;
        const shopSelect = form.elements.namedItem("shopId") as HTMLSelectElement;
        const shopName = shopSelect?.selectedOptions[0]?.textContent ?? "";
        if (!confirm(`Invite ${email} to ${shopName} with ${ROLE_LABEL[role] ?? role} access?`)) {
          e.preventDefault();
        }
      }}
    >
      <label className="flex flex-col gap-1">
        <Label>Branch</Label>
        <select
          name="shopId"
          defaultValue={shops[0]?.shopId}
          className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink"
        >
          {shops.map((s) => (
            <option key={s.shopId} value={s.shopId}>
              {s.shopName}
            </option>
          ))}
        </select>
      </label>
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
