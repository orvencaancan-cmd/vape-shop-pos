"use client";

import { useActionState } from "react";
import { submitManualPaymentAction, type ManualPaymentState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ManualPaymentState = {};

export function ManualPaymentPanel({
  shopId,
  amount,
  hasPending,
}: {
  shopId: string;
  amount: number;
  hasPending: boolean;
}) {
  const boundAction = submitManualPaymentAction.bind(null, shopId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (hasPending || state.success) {
    return (
      <div className="mt-4 rounded-xl border border-hairline bg-canvas-soft p-4 text-sm text-body">
        Payment submitted — we&apos;ll activate your subscription once it&apos;s confirmed. This
        is usually quick, but since it&apos;s reviewed by hand it may take a little while.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-hairline bg-canvas-soft p-4">
      <p className="text-sm text-body">
        VapeStock doesn&apos;t currently support automated recurring billing — payment
        providers treat vape shop businesses as high-risk, so subscriptions are paid
        manually for now. Pay <span className="font-medium text-ink">₱{amount.toFixed(2)}</span>{" "}
        via GCash or Maya below, then submit your reference number and we&apos;ll activate
        your subscription once we confirm it.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <QrCard label="GCash" src="/gcash-qr.png" />
        <QrCard label="Maya" src="/maya-qr.png" />
      </div>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input type="radio" name="method" value="gcash" defaultChecked required />
            GCash
          </label>
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input type="radio" name="method" value="maya" required />
            Maya
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <Label>Reference number</Label>
          <Input
            name="referenceNote"
            placeholder="From your GCash/Maya receipt"
            required
            className="text-sm"
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "I've paid — submit reference"}
        </Button>
        {state.error && <span className="text-sm text-error">{state.error}</span>}
      </form>
    </div>
  );
}

function QrCard({ label, src }: { label: string; src: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-hairline bg-canvas p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <img
        src={src}
        alt={`${label} QR code`}
        className="h-32 w-32 rounded-md border border-hairline object-contain"
      />
      <a
        href={src}
        download={`vapestock-${label.toLowerCase()}-qr.png`}
        className="text-xs text-primary underline underline-offset-2"
      >
        Download QR
      </a>
    </div>
  );
}
