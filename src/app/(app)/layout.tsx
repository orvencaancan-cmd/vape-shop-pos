import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { signOutAction, backToAdminAction } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { VapeStockLogo } from "@/components/vapestock-logo";
import { Card } from "@/components/ui/card";
import { hasBillingAccess, daysUntilTrialEnd } from "@/lib/billing-status";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.platformAdmin) {
    if (profile.shop.suspended) redirect("/shop-suspended");
    if (profile.shop.archived && profile.role !== "owner") redirect("/shop-suspended");
    if (!hasBillingAccess(profile.shop)) redirect("/billing-required");
  }

  const trialDaysLeft = daysUntilTrialEnd(profile.shop.trialEndsAt);
  const showTrialReminder =
    !profile.platformAdmin &&
    profile.role === "owner" &&
    profile.shop.subscriptionStatus === "trialing" &&
    trialDaysLeft !== null &&
    trialDaysLeft >= 0 &&
    trialDaysLeft <= 3;

  const navItems = profile.shop.isPlatformShop
    ? [
        { href: "/admin", label: "Admin", show: true },
        { href: "/admin/payments", label: "Payments", show: true },
        { href: "/admin/reports", label: "Reports", show: true },
      ].filter((item) => item.show)
    : profile.inAdminOverview
      ? [
          { href: "/dashboard", label: "Dashboard", show: true },
          { href: "/settings/staff", label: "Staff", show: true },
          { href: "/branches", label: "Branches", show: true },
          { href: "/settings/billing", label: "Billing", show: true },
          { href: "/settings/loyalty", label: "Loyalty", show: true },
          { href: "/reports", label: "Reports", show: true },
        ].filter((item) => item.show)
      : [
          { href: "/sell", label: "Sales", show: true },
          { href: "/expenses", label: "Expenses", show: true },
          { href: "/inventory", label: "Inventory", show: true },
          { href: "/audit", label: "Audit", show: true },
          { href: "/dashboard", label: "Dashboard", show: profile.role === "owner" },
          { href: "/reports", label: "Reports", show: profile.role === "owner" },
          { href: "/settings/suppliers", label: "Suppliers", show: profile.role === "owner" },
          { href: "/settings/staff", label: "Staff", show: profile.role === "owner" },
          { href: "/branches", label: "Branches", show: profile.role === "owner" },
          { href: "/settings/billing", label: "Billing", show: profile.role === "owner" },
          { href: "/settings/loyalty", label: "Loyalty", show: profile.role === "owner" },
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
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-hairline bg-canvas-soft px-4 py-3 sm:py-4">
          <VapeStockLogo className="text-sm sm:text-base" />
          <div className="flex min-w-0 items-center justify-center gap-2">
            {profile.shop.logoUrl && !profile.inAdminOverview && !profile.shop.isPlatformShop && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.shop.logoUrl}
                alt={`${profile.shop.name} logo`}
                className="h-9 w-9 shrink-0 bg-canvas-soft object-contain sm:h-11 sm:w-11"
              />
            )}
            <span className="truncate text-center text-sm font-semibold uppercase tracking-[0.25em] text-ink sm:text-lg sm:tracking-[0.35em]">
              {profile.inAdminOverview ? (profile.displayName ?? "Admin") : profile.shop.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {profile.ownedShopCount > 1 && !profile.inAdminOverview && !profile.shop.isPlatformShop && (
              <form action={backToAdminAction}>
                <button
                  type="submit"
                  className="whitespace-nowrap text-sm text-muted transition-colors hover:text-ink"
                >
                  <span className="hidden sm:inline">← Back to </span>Admin
                </button>
              </form>
            )}
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                className="whitespace-nowrap text-sm text-muted transition-colors hover:text-ink"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl items-center gap-4 overflow-x-auto px-4 py-3 text-sm">
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
      {showTrialReminder && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <Card padding="sm" className="border-warning/40 bg-warning/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-warning">⚠</span>
                <h2 className="text-sm font-medium text-warning">
                  {trialDaysLeft === 0
                    ? "Your free trial ends today"
                    : `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"}`}
                </h2>
              </div>
              <Link
                href="/settings/billing"
                className="text-xs text-warning underline underline-offset-2"
              >
                Subscribe
              </Link>
            </div>
          </Card>
        </div>
      )}
      <div className="animate-fade-in-up">{children}</div>
    </div>
  );
}
