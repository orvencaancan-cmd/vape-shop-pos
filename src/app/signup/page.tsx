import { SignUpForm } from "./signup-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignUpPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="animate-fade-in-up text-center">
        <h1 className="font-serif text-3xl font-normal text-ink">
          Start your free trial
        </h1>
        <p className="mt-1 text-sm text-muted">
          14 days free, no charge until it ends.
        </p>
      </div>
      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <SignUpForm />
      </div>
    </main>
  );
}
