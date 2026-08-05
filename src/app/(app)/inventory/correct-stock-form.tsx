"use client";

import { useActionState, useState } from "react";
import { correctStockAction, type ActionState } from "./actions";

const initialState: ActionState = {};

// Collapsed behind a toggle rather than always-visible like ReceiveStockForm
// -- correcting a wrong count is a rare, deliberate fix, not a routine
// action, so it shouldn't clutter every row by default.
export function CorrectStockForm({
  variantId,
  currentQty,
}: {
  variantId: string;
  currentQty: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(correctStockAction, initialState);

  // Close the form once the action succeeds -- adjusted during render
  // (React's recommended pattern) rather than in an effect, since setState
  // inside an effect here would just trigger an extra render for no reason.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (!state.error) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-primary underline underline-offset-2"
      >
        Correct stock
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="variantId" value={variantId} />
      <input
        name="newQty"
        type="number"
        min={0}
        defaultValue={currentQty}
        required
        className="w-16 rounded border border-hairline bg-canvas px-2 py-1 text-ink"
      />
      <input
        name="reason"
        type="text"
        placeholder="Reason (required)"
        required
        className="w-40 rounded border border-hairline bg-canvas px-2 py-1 text-ink placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-primary px-2 py-1 font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-muted underline underline-offset-2"
      >
        Cancel
      </button>
      {state.error && <span className="text-error">{state.error}</span>}
    </form>
  );
}
