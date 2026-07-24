"use client";

import { useActionState } from "react";
import { transferStaffAction, type ActionState } from "./actions";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

const initialState: ActionState = {};

export function AdminStaffRow({
  profileId,
  displayName,
  email,
  role,
  currentShopId,
  currentShopName,
  otherShops,
}: {
  profileId: string;
  displayName: string | null;
  email: string;
  role: "owner" | "staff";
  currentShopId: string;
  currentShopName: string;
  otherShops: ShopMembership[];
}) {
  const boundTransfer = transferStaffAction.bind(null, profileId, currentShopId);
  const [state, formAction, pending] = useActionState(boundTransfer, initialState);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-canvas-soft p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{displayName || email}</p>
        <p className="text-xs text-muted">
          {email} · {currentShopName} · {role === "owner" ? "Owner" : "Staff"}
        </p>
      </div>

      {role === "staff" && otherShops.length > 0 && (
        <form
          action={formAction}
          className="flex items-center gap-2"
          onSubmit={(e) => {
            const form = e.currentTarget;
            const select = form.elements.namedItem("toShopId") as HTMLSelectElement;
            const toName = select?.selectedOptions[0]?.textContent ?? "";
            if (
              !confirm(
                `Move ${displayName || email} from ${currentShopName} to ${toName}? They'll lose access at ${currentShopName} immediately.`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <select
            name="toShopId"
            defaultValue={otherShops[0]?.shopId}
            className="rounded-lg border border-hairline bg-canvas px-2 py-1 text-xs text-ink"
          >
            {otherShops.map((s) => (
              <option key={s.shopId} value={s.shopId}>
                {s.shopName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink disabled:opacity-50"
          >
            {pending ? "Moving…" : "Transfer"}
          </button>
        </form>
      )}

      {state.error && <p className="w-full text-xs text-error">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-success">{state.success}</p>}
    </div>
  );
}
