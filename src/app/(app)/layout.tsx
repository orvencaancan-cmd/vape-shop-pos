import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { signOutAction } from "@/lib/auth/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const brandColor = profile.shop.primaryColor || "#0f172a";

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
      className="min-h-screen bg-slate-50"
      style={{ "--brand": brandColor } as React.CSSProperties}
    >
      <header className="border-b border-slate-200 bg-white">
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
            <span
              className="truncate font-semibold"
              style={{ color: "var(--brand)" }}
            >
              {profile.shop.name}
            </span>
          </div>
          <form action={signOutAction} className="shrink-0">
            <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
              Log out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 text-slate-600 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div>{children}</div>
    </div>
  );
}
