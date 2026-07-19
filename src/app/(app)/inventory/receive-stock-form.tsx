"use client";

import { useActionState, useRef, useEffect } from "react";
import { receiveStockAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function ReceiveStockForm({
  variantId,
  suppliers,
}: {
  variantId: string;
  suppliers: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(receiveStockAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-center gap-2 text-xs"
    >
      <input type="hidden" name="variantId" value={variantId} />
      <input
        name="quantity"
        type="number"
        min={1}
        placeholder="Qty"
        required
        className="w-16 rounded border border-hairline bg-canvas px-2 py-1 text-ink placeholder:text-muted"
      />
      <select
        name="supplierId"
        defaultValue=""
        className="rounded border border-hairline bg-canvas px-2 py-1 text-ink"
      >
        <option value="">Supplier…</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        name="newSupplierName"
        type="text"
        placeholder="or new supplier name"
        className="w-32 rounded border border-hairline bg-canvas px-2 py-1 text-ink placeholder:text-muted"
      />
      <input
        name="unitCost"
        type="number"
        min={0}
        step="0.01"
        placeholder="Unit cost"
        className="w-20 rounded border border-hairline bg-canvas px-2 py-1 text-ink placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-primary px-3 py-1 font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-60"
      >
        {pending ? "Saving…" : "Receive"}
      </button>
      {state.error && <span className="text-error">{state.error}</span>}
    </form>
  );
}
