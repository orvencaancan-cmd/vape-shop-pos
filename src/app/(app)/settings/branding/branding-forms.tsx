"use client";

import { useActionState } from "react";
import { uploadLogoAction, updateColorAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function LogoForm({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(uploadLogoAction, initialState);

  return (
    <div className="flex items-center gap-4">
      {currentLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentLogoUrl}
          alt="Current logo"
          className="h-16 w-16 rounded-md border border-hairline object-contain"
        />
      )}
      <form action={formAction} className="flex items-center gap-2">
        <input name="logo" type="file" accept="image/*" required className="text-sm text-ink" />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
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
