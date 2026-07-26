"use client";

import { useActionState, useState } from "react";
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
      {state.success && <span className="text-sm text-success">Saved.</span>}
    </form>
  );
}

export function LogoForm({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(updateLogoAction, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  const displayUrl = previewUrl ?? currentLogoUrl;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {displayUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayUrl}
          alt="Shop logo"
          className="h-20 w-20 rounded-lg border border-hairline bg-canvas-soft object-contain"
        />
      )}
      <input
        name="logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-canvas-strong file:px-3 file:py-1.5 file:text-sm file:text-body"
      />
      {previewUrl && <p className="text-xs text-muted">Preview above — click Apply to save it.</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || !previewUrl}>
          {pending ? "Applying…" : "Apply"}
        </Button>
        {state.error && <span className="text-sm text-error">{state.error}</span>}
        {state.success && <span className="text-sm text-success">Logo updated.</span>}
      </div>
      <p className="text-xs text-muted">PNG, JPG, or WebP, up to 2MB. Shown in your header and home-screen icon.</p>
    </form>
  );
}
