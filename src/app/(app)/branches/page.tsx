import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { AddShopForm } from "./add-shop-form";
import { BranchRow } from "./branch-row";

export default async function BranchesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.role !== "owner") redirect("/inventory");

  const ownedShops = profile.shops.filter((s) => s.role === "owner");

  if (ownedShops.length <= 1) {
    return (
      <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
        <h1 className="heading text-2xl">Branches</h1>
        <p className="mt-1 text-sm text-muted">Every shop you own, and a way to add another.</p>

        <ul className="mt-6 flex flex-col gap-2">
          {ownedShops.map((s) => (
            <li
              key={s.shopId}
              className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm"
            >
              <span className="text-ink">{s.shopName}</span>
              <span className="text-xs text-muted">Active</span>
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

  const activeShops = ownedShops.filter((s) => !s.archivedAt);
  const archivedShops = ownedShops.filter((s) => s.archivedAt);

  return (
    <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
      <h1 className="heading text-2xl">Branches</h1>
      <p className="mt-1 text-sm text-muted">
        Add, archive, or step into any of your {activeShops.length} branches.
      </p>

      <h2 className="mt-6 text-sm font-medium text-muted">Active branches</h2>
      <div className="mt-2 flex flex-col gap-2">
        {activeShops.map((s) => (
          <BranchRow key={s.shopId} shopId={s.shopId} shopName={s.shopName} archived={false} />
        ))}
      </div>

      {archivedShops.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-medium text-muted">Archived branches</h2>
          <p className="mt-1 text-xs text-muted">
            Hidden from daily use, but all their history is kept.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {archivedShops.map((s) => (
              <BranchRow key={s.shopId} shopId={s.shopId} shopName={s.shopName} archived={true} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-medium text-muted">Add another branch</h2>
      <p className="mt-1 text-xs text-muted">
        Each branch gets its own inventory and staff. Billing setup is coming soon.
      </p>
      <AddShopForm />
    </main>
  );
}
