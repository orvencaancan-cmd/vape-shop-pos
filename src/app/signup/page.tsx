import { SignUpForm } from "./signup-form";
import { SplitAuthShell } from "@/components/split-auth-shell";

export default function SignUpPage() {
  return (
    <SplitAuthShell
      heading="Start your free trial"
      subtitle="14 days free, no charge until it ends."
    >
      <SignUpForm />
    </SplitAuthShell>
  );
}
