import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/lib/auth/actions";
import { buttonClasses } from "@/components/ui/button";

export function AuthCardShell({
  heading,
  subtitle,
  showThemeToggle = true,
  showLogout = false,
  children,
}: {
  heading: string;
  subtitle?: ReactNode;
  showThemeToggle?: boolean;
  showLogout?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 text-center">
      {showThemeToggle && (
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
      )}

      <div className="animate-fade-in-up">
        <h1 className="heading text-2xl">{heading}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      {children && (
        <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          {children}
        </div>
      )}

      {showLogout && (
        <form action={signOutAction} className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <button type="submit" className={buttonClasses("secondary", "md")}>
            Log out
          </button>
        </form>
      )}
    </main>
  );
}
