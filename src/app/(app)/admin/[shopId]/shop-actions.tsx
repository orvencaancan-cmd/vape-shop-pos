"use client";

import { useActionState } from "react";
import {
  suspendShopAction,
  reactivateShopAction,
  updateTrialEndAction,
  type ActionState,
} from "./actions";

const initialState: ActionState = {};

export function ShopActions({
  shopId,
  shopName,
  suspended,
  trialEndsAt,
}: {
  shopId: string;
  shopName: string;
  suspended: boolean;
  trialEndsAt: string | null;
}) {
  const boundTrial = updateTrialEndAction.bind(null, shopId);
  const [trialState, trialFormAction, trialPending] = useActionState(boundTrial, initialState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-medium text-muted">Access</h2>
        <form
          action={suspended ? reactivateShopAction.bind(null, shopId) : suspendShopAction.bind(null, shopId)}
          onSubmit={(e) => {
            const message = suspended
              ? `Reactivate ${shopName}? They'll be able to use the app again immediately.`
              : `Suspend ${shopName}? Everyone on that shop will be locked out immediately.`;
            if (!confirm(message)) e.preventDefault();
          }}
          className="mt-2"
        >
          <button
            type="submit"
            className={
              suspended
                ? "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
                : "rounded-lg border border-error/40 px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10"
            }
          >
            {suspended ? "Reactivate shop" : "Suspend shop"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted">Trial end date</h2>
        <form action={trialFormAction} className="mt-2 flex items-center gap-2">
          <input
            type="date"
            name="trialEndsAt"
            defaultValue={trialEndsAt ?? ""}
            className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={trialPending}
            className="rounded-lg bg-canvas-strong px-3 py-1.5 text-sm text-body transition-colors hover:text-ink disabled:opacity-50"
          >
            {trialPending ? "Saving…" : "Save"}
          </button>
        </form>
        {trialState.error && <p className="mt-1 text-xs text-error">{trialState.error}</p>}
      </div>
    </div>
  );
}
