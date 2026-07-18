"use client";

import { useActionState } from "react";
import { changeRoleAction, removeStaffAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function MemberRow({
  profileId,
  displayName,
  email,
  role,
  isCurrentUser,
  canDemoteOrRemove,
}: {
  profileId: string;
  displayName: string | null;
  email: string;
  role: "owner" | "staff";
  isCurrentUser: boolean;
  canDemoteOrRemove: boolean;
}) {
  const boundRoleAction = changeRoleAction.bind(null, profileId);
  const [state, formAction, pending] = useActionState(boundRoleAction, initialState);
  const boundRemove = removeStaffAction.bind(null, profileId);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">
          {displayName || email} {isCurrentUser && <span className="text-slate-400">(you)</span>}
        </p>
        <p className="text-xs text-slate-400">{email}</p>
      </div>

      <form action={formAction} className="flex items-center gap-2">
        <select
          key={role}
          name="role"
          defaultValue={role}
          disabled={!canDemoteOrRemove && role === "owner"}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>

      <form action={boundRemove}>
        <button
          type="submit"
          disabled={!canDemoteOrRemove && role === "owner"}
          className="text-xs text-red-600 underline disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Remove
        </button>
      </form>

      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
      {!canDemoteOrRemove && role === "owner" && (
        <p className="w-full text-xs text-slate-400">
          Can&apos;t change or remove the shop&apos;s last owner.
        </p>
      )}
    </div>
  );
}
