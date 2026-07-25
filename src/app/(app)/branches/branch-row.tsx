"use client";

import { useActionState } from "react";
import { switchShopAction } from "@/lib/auth/actions";
import {
  archiveShopAction,
  reactivateShopAction,
  type ActionState,
} from "./actions";

const initialState: ActionState = {};

export function BranchRow({
  shopId,
  shopName,
  archived,
}: {
  shopId: string;
  shopName: string;
  archived: boolean;
}) {
  const boundAction = (archived ? reactivateShopAction : archiveShopAction).bind(null, shopId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const boundEnter = switchShopAction.bind(null, shopId, "owner", undefined);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-canvas-soft p-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{shopName}</span>

      {!archived && (
        <form action={boundEnter}>
          <button
            type="submit"
            className="text-xs text-muted underline underline-offset-2 hover:text-ink"
          >
            Enter this branch
          </button>
        </form>
      )}

      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className={
            archived
              ? "rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink disabled:opacity-50"
              : "text-xs text-error underline disabled:opacity-50"
          }
        >
          {pending ? "Saving…" : archived ? "Reactivate" : "Archive"}
        </button>
      </form>

      {state.error && <p className="w-full text-xs text-error">{state.error}</p>}
    </div>
  );
}
