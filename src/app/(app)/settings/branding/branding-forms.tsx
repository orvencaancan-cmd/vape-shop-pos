"use client";

import { useActionState } from "react";
import { updateColorAction, updateLogoAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

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

export function LogoForm({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(updateLogoAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {currentLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentLogoUrl}
          alt="Current shop logo"
          className="h-20 w-20 rounded-lg border border-hairline bg-canvas-soft object-contain"
        />
      )}
      <input
        name="logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-canvas-strong file:px-3 file:py-1.5 file:text-sm file:text-body"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Uploading…" : "Upload logo"}
        </Button>
        {state.error && <span className="text-sm text-error">{state.error}</span>}
      </div>
      <p className="text-xs text-muted">PNG, JPG, or WebP, up to 2MB. Used for your shop&apos;s home-screen icon.</p>
    </form>
  );
}
