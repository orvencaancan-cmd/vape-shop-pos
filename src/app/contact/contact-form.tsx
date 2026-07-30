"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitContactAction, type ActionState } from "./actions";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactAction, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-body">
          Thanks for reaching out — we&apos;ll get back to you soon.
        </p>
        <Link href="/" className="text-sm text-primary underline underline-offset-2">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input name="name" required />
      </label>

      <label className="flex flex-col gap-1.5">
        <Label>Email</Label>
        <Input name="email" type="email" required />
      </label>

      <label className="flex flex-col gap-1.5">
        <Label>Message</Label>
        <Textarea name="message" rows={5} required />
      </label>

      <label className="absolute -left-[9999px]" aria-hidden="true" tabIndex={-1}>
        Company
        <input name="company" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      {state.error && (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send message"}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/" className="text-primary underline underline-offset-2">
          Back to home
        </Link>
      </p>
    </form>
  );
}
