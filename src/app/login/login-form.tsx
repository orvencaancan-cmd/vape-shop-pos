"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
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

      <p className="text-center text-sm text-muted">
        Don&apos;t have a shop yet?{" "}
        <Link href="/signup" className="text-primary underline underline-offset-2">
          Start a free trial
        </Link>
      </p>
    </form>
  );
}
