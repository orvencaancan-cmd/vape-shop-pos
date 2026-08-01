"use client";

import { useActionState } from "react";
import { updateLoyaltySettingsAction, type LoyaltySettingsState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: LoyaltySettingsState = {};

export function LoyaltyForm({
  shopId,
  earnEnabled,
  redeemEnabled,
  rewardPercent,
}: {
  shopId: string;
  earnEnabled: boolean;
  redeemEnabled: boolean;
  rewardPercent: number;
}) {
  const boundAction = updateLoyaltySettingsAction.bind(null, shopId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <label className="flex items-center gap-1.5 text-sm text-ink">
        <input type="checkbox" name="earnEnabled" defaultChecked={earnEnabled} />
        Give rewards here
      </label>
      <label className="flex items-center gap-1.5 text-sm text-ink">
        <input type="checkbox" name="redeemEnabled" defaultChecked={redeemEnabled} />
        Accept redemptions here
      </label>
      <label className="flex flex-col gap-1">
        <Label>Reward %</Label>
        <Input
          name="rewardPercent"
          type="number"
          step="0.1"
          min={0}
          max={100}
          defaultValue={rewardPercent}
          className="w-24 text-sm"
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error && <span className="text-sm text-error">{state.error}</span>}
      {state.success && <span className="text-sm text-success">Saved</span>}
    </form>
  );
}
