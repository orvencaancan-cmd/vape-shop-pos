import { LoginForm } from "./login-form";
import { SplitAuthShell } from "@/components/split-auth-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <SplitAuthShell heading="Log in" subtitle="Enter your email and password.">
      <LoginForm authError={error} />
    </SplitAuthShell>
  );
}
