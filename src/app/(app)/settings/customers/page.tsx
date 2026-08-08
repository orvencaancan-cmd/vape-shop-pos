import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { CustomerList } from "./customer-list";

// Loyalty customers are owner_user_id-scoped (business-wide, not per-shop),
// so unlike Inventory/Promos this page doesn't need a separate
// admin-overview vs. branch view -- the same list either way. Reaching
// Admin Overview already implies owning at least one shop (ownedShopCount
// > 1), so it's trusted the same way Promos already trusts it without a
// separate role check.
export default async function CustomersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (!profile.inAdminOverview && profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("loyalty_customers")
    .select("name, phone, credit_balance")
    .eq("owner_user_id", profile.ownerUserId)
    .order("name", { ascending: true, nullsFirst: false });

  const items = (customers ?? []).map((c) => ({
    name: c.name as string | null,
    phone: c.phone as string,
    creditBalance: Number(c.credit_balance),
  }));

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Customers</h1>
      <p className="mt-1 text-sm text-muted">
        Everyone registered for store credit, shared across all of your branches.
      </p>
      <div className="mt-6">
        <CustomerList customers={items} />
      </div>
    </main>
  );
}
