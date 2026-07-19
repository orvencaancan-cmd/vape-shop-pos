import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <h1 className="animate-fade-in-up text-center font-serif text-3xl font-normal text-ink">
        Log in
      </h1>
      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <LoginForm />
      </div>
    </main>
  );
}
