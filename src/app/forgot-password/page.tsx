import { ForgotPasswordForm } from "./forgot-password-form";
import { AuthCardShell } from "@/components/auth-card-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthCardShell
      heading="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new one."
    >
      <ForgotPasswordForm />
    </AuthCardShell>
  );
}
