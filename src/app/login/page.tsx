import { LoginForm } from "./login-form";
import { SplitAuthShell } from "@/components/split-auth-shell";

export default function LoginPage() {
  return (
    <SplitAuthShell heading="Log in" subtitle="Enter your email and password.">
      <LoginForm />
    </SplitAuthShell>
  );
}
