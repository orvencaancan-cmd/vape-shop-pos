"use client";

import { useActionState, useState } from "react";
import { uploadLogoAction, updateColorAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

const MAX_LOGO_BYTES = 4.5 * 1024 * 1024;

export function LogoForm({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(uploadLogoAction, initialState);
  const [clientError, setClientError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {currentLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentLogoUrl}
            alt="Current logo"
            className="h-16 w-16 rounded-md border border-hairline object-contain"
          />
        )}
        <form
          action={formAction}
          className="flex items-center gap-2"
          onSubmit={(e) => {
            const input = e.currentTarget.elements.namedItem("logo") as HTMLInputElement;
            const file = input?.files?.[0];
            if (file && file.size > MAX_LOGO_BYTES) {
              e.preventDefault();
              setClientError("Logo must be under 4.5MB");
            } else {
              setClientError(null);
            }
          }}
        >
          <input
            name="logo"
            type="file"
            accept="image/*"
            required
            className="text-sm text-ink"
            onChange={() => setClientError(null)}
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </div>
      <p className="text-xs text-muted">
        Displays in a banner across the top of the app. Recommended: at least 600px tall, PNG
        with a transparent background, under 4.5MB.
      </p>
      {(clientError || state.error) && (
        <p className="text-sm text-error">{clientError ?? state.error}</p>
      )}
    </div>
  );
}

export function ColorForm({ currentColor }: { currentColor: string }) {
  const [state, formAction, pending] = useActionState(updateColorAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="primaryColor"
        type="color"
        defaultValue={currentColor}
        className="h-9 w-14 rounded border border-hairline bg-canvas"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save color"}
      </Button>
      {state.error && <span className="text-sm text-error">{state.error}</span>}
    </form>
  );
}
