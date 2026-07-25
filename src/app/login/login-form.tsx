"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: LoginState = {};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  otp_expired: "That link has expired. Request a new password reset email and use it within a few minutes.",
  access_denied: "That link is no longer valid. Request a new password reset email and try again.",
};

export function LoginForm({ authError }: { authError?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {authError && (
        <p className="text-sm text-error" role="alert">
          {AUTH_ERROR_MESSAGES[authError] ??
            "That link didn't work. Request a new password reset email and try again."}
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <Label>Email</Label>
        <Input name="email" type="email" required />
      </label>
      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary underline underline-offset-2">
            Forgot password?
          </Link>
        </div>
        <Input name="password" type="password" required />
      </label>

      {state.error && (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-sm text-muted">
        Don&apos;t have a shop yet?{" "}
        <Link href="/signup" className="text-primary underline underline-offset-2">
          Start a free trial
        </Link>
      </p>
    </form>
  );
}
