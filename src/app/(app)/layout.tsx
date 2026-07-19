import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { signOutAction } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const navItems = [
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {profile.shop.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.shop.logoUrl}
                alt={`${profile.shop.name} logo`}
                className="h-7 w-7 shrink-0 rounded object-contain"
              />
            )}
            <span className="truncate font-serif text-lg font-normal text-primary">
              {profile.shop.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
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
        <nav className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
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
