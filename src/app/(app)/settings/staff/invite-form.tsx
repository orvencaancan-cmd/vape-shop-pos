"use client";

import { useActionState } from "react";
import { inviteStaffAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteStaffAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Email</span>
        <input
          name="email"
          type="email"
          required
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Name (optional)</span>
        <input
          name="displayName"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Inviting…" : "Send invite"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.success && <span className="text-sm text-green-700">{state.success}</span>}
    </form>
  );
}
