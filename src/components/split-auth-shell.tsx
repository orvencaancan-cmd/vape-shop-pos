import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeaturePanel } from "@/components/feature-panel";

export function SplitAuthShell({
  heading,
  subtitle,
  children,
}: {
  heading: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <span className="heading text-sm">VapeStock</span>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="animate-fade-in-up">
              <h1 className="heading text-3xl">{heading}</h1>
              <p className="mt-1 text-sm text-muted">{subtitle}</p>
            </div>
            <div className="animate-fade-in-up mt-6" style={{ animationDelay: "60ms" }}>
              {children}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden border-l border-hairline bg-canvas-soft px-8 py-10 lg:flex lg:flex-col lg:justify-center">
        <div className="mx-auto w-full max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">What it does</p>
          <FeaturePanel className="mt-4" />
        </div>
      </div>
    </div>
  );
}
