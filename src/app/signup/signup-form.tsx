"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type SignUpState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: SignUpState = {};

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  if (state.success) {
    return (
      <div className="animate-fade-in-up rounded-lg border border-hairline bg-success/10 p-4 text-sm text-success">
        Check your email to confirm your account — once confirmed, you&apos;ll
        set up your shop and start your 14-day free trial.
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Shop name" name="shopName" placeholder="Cloud Nine Vapes" />
      <Field label="Your name" name="displayName" placeholder="Jamie Rivera" />
      <Field label="Email" name="email" type="email" placeholder="you@example.com" />
      <Field
        label="Password"
        name="password"
        type="password"
        placeholder="At least 8 characters"
      />

      {state.error && (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Start free trial"}
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline underline-offset-2">
          Log in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input name={name} type={type} placeholder={placeholder} required />
    </label>
  );
}
