import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { AddShopForm } from "./add-shop-form";

export default async function ShopsSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.role !== "owner") redirect("/inventory");

  return (
    <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
      <h1 className="heading text-2xl">Shops</h1>
      <p className="mt-1 text-sm text-muted">Every shop you own, and a way to add another.</p>

      <ul className="mt-6 flex flex-col gap-2">
        {profile.shops.map((s) => (
          <li
            key={s.shopId}
            className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm"
          >
            <span className="text-ink">{s.shopName}</span>
            {s.shopId === profile.shopId && <span className="text-xs text-muted">Active</span>}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-muted">Add another shop</h2>
        <p className="mt-1 text-xs text-muted">
          Each shop gets its own inventory and staff. Billing setup is coming soon.
        </p>
        <AddShopForm />
      </div>
    </main>
  );
}
