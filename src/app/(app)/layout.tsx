import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { signOutAction } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { AgentOneLogo } from "@/components/agentone-logo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.suspended && !profile.platformAdmin) redirect("/shop-suspended");

  const navItems = profile.shop.isPlatformShop
    ? [
        { href: "/admin", label: "Admin", show: true },
        { href: "/admin/reports", label: "Reports", show: true },
      ].filter((item) => item.show)
    : [
        { href: "/sell", label: "Sell", show: true },
        { href: "/inventory", label: "Inventory", show: true },
        { href: "/dashboard", label: "Dashboard", show: profile.role === "owner" },
        { href: "/reports", label: "Reports", show: profile.role === "owner" },
        { href: "/settings/suppliers", label: "Suppliers", show: profile.role === "owner" },
        { href: "/settings/staff", label: "Staff", show: profile.role === "owner" },
        { href: "/settings/billing", label: "Billing", show: profile.role === "owner" },
        { href: "/settings/branding", label: "Branding", show: profile.role === "owner" },
        { href: "/admin", label: "Admin", show: profile.platformAdmin },
      ].filter((item) => item.show);

  return (
    <div
      className="min-h-screen bg-canvas"
      style={
        profile.shop.primaryColor
          ? ({ "--color-primary": profile.shop.primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <header className="border-b border-hairline bg-canvas">
        <div className="relative flex h-16 items-center justify-center border-b border-hairline bg-canvas-soft px-4 sm:h-20">
          <AgentOneLogo className="absolute left-4 text-xs sm:text-sm" />
          <span className="max-w-[55%] truncate text-center text-sm font-semibold uppercase tracking-[0.25em] text-ink sm:max-w-[60%] sm:text-lg sm:tracking-[0.35em]">
            {profile.shop.name}
          </span>
          <div className="absolute right-4 flex shrink-0 items-center gap-3">
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 py-3 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 text-body transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="animate-fade-in-up">{children}</div>
    </div>
  );
}
