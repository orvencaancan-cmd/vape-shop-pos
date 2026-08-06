"use client";

import { useActionState } from "react";
import {
  changeRoleInBranchAction,
  removeStaffFromBranchAction,
  transferStaffAction,
  type ActionState,
} from "./actions";
import type { ShopMembership } from "@/lib/auth/get-current-profile";
import { ActionButton } from "@/components/action-button";

const initialState: ActionState = {};

export function AdminStaffRow({
  profileId,
  displayName,
  email,
  role,
  currentShopId,
  currentShopName,
  otherShops,
  canDemoteOrRemove,
}: {
  profileId: string;
  displayName: string | null;
  email: string;
  role: "owner" | "staff";
  currentShopId: string;
  currentShopName: string;
  otherShops: ShopMembership[];
  canDemoteOrRemove: boolean;
}) {
  const boundRole = changeRoleInBranchAction.bind(null, profileId, currentShopId);
  const [roleState, roleFormAction, rolePending] = useActionState(boundRole, initialState);

  const boundRemove = removeStaffFromBranchAction.bind(null, profileId, currentShopId);

  const boundTransfer = transferStaffAction.bind(null, profileId, currentShopId);
  const [transferState, transferFormAction, transferPending] = useActionState(
    boundTransfer,
    initialState,
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-canvas-soft p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{displayName || email}</p>
        <p className="text-xs text-muted">{email} · {currentShopName}</p>
      </div>

      <form action={roleFormAction} className="flex items-center gap-2">
        <select
          key={role}
          name="role"
          defaultValue={role}
          disabled={!canDemoteOrRemove && role === "owner"}
          className="rounded-lg border border-hairline bg-canvas px-2 py-1 text-xs text-ink disabled:opacity-50"
        >
          <option value="staff">Staff</option>
          <option value="owner">Admin</option>
        </select>
        <button
          type="submit"
          disabled={rolePending}
          className="rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink disabled:opacity-50"
        >
          {rolePending ? "Saving…" : "Save"}
        </button>
      </form>

      {role === "staff" && otherShops.length > 0 && (
        <form
          action={transferFormAction}
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
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Reassign to
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
          </label>
          <button
            type="submit"
            disabled={transferPending}
            className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            {transferPending ? "Moving…" : "Reassign"}
          </button>
        </form>
      )}

      <ActionButton
        action={boundRemove}
        disabled={!canDemoteOrRemove && role === "owner"}
        className="text-xs text-error underline disabled:cursor-not-allowed disabled:text-muted"
      >
        Remove
      </ActionButton>

      {roleState.error && <p className="w-full text-xs text-error">{roleState.error}</p>}
      {transferState.error && <p className="w-full text-xs text-error">{transferState.error}</p>}
      {transferState.success && (
        <p className="w-full text-xs text-success">{transferState.success}</p>
      )}
      {!canDemoteOrRemove && role === "owner" && (
        <p className="w-full text-xs text-muted">
          Can&apos;t change or remove this branch&apos;s last admin.
        </p>
      )}
    </div>
  );
}
