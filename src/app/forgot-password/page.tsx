import { ForgotPasswordForm } from "./forgot-password-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ForgotPasswordPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <h1 className="animate-fade-in-up font-serif text-3xl font-normal text-ink">
          Reset your password
        </h1>
        <p
          className="animate-fade-in-up mt-1 text-sm text-muted"
          style={{ animationDelay: "40ms" }}
        >
          Enter your email and we&apos;ll send you a link to set a new one.
        </p>
      </div>
      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
