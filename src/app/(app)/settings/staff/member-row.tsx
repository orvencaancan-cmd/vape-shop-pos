"use client";

import { useActionState } from "react";
import { changeRoleAction, removeStaffAction, resendInviteAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function MemberRow({
  profileId,
  displayName,
  email,
  role,
  isCurrentUser,
  canDemoteOrRemove,
  pending: invitePending,
}: {
  profileId: string;
  displayName: string | null;
  email: string;
  role: "owner" | "staff";
  isCurrentUser: boolean;
  canDemoteOrRemove: boolean;
  pending: boolean;
}) {
  const boundRoleAction = changeRoleAction.bind(null, profileId);
  const [state, formAction, pending] = useActionState(boundRoleAction, initialState);
  const boundRemove = removeStaffAction.bind(null, profileId);
  const boundResend = resendInviteAction.bind(null, email);
  const [resendState, resendFormAction, resendPending] = useActionState(
    boundResend,
    initialState,
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-canvas-soft p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {displayName || email} {isCurrentUser && <span className="text-muted">(you)</span>}
          {invitePending && (
            <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              Invite pending
            </span>
          )}
        </p>
        <p className="text-xs text-muted">{email}</p>
      </div>

      {invitePending && (
        <form action={resendFormAction}>
          <button
            type="submit"
            disabled={resendPending}
            className="text-xs text-primary underline underline-offset-2 disabled:opacity-50"
          >
            {resendPending ? "Resending…" : "Resend invite"}
          </button>
        </form>
      )}

      <form action={formAction} className="flex items-center gap-2">
        <select
          key={role}
          name="role"
          defaultValue={role}
          disabled={!canDemoteOrRemove && role === "owner"}
          className="rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink disabled:opacity-50"
        >
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-canvas-strong px-2 py-1 text-xs text-body transition-colors hover:text-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>

      <form action={boundRemove}>
        <button
          type="submit"
          disabled={!canDemoteOrRemove && role === "owner"}
          className="text-xs text-error underline disabled:cursor-not-allowed disabled:text-muted"
        >
          Remove
        </button>
      </form>

      {state.error && <p className="w-full text-xs text-error">{state.error}</p>}
      {resendState.error && <p className="w-full text-xs text-error">{resendState.error}</p>}
      {resendState.success && (
        <p className="w-full text-xs text-success">{resendState.success}</p>
      )}
      {!canDemoteOrRemove && role === "owner" && (
        <p className="w-full text-xs text-muted">
          Can&apos;t change or remove the shop&apos;s last owner.
        </p>
      )}
    </div>
  );
}
