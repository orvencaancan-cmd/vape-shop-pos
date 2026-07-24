import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminInviteForm } from "./admin-invite-form";
import { AdminStaffRow } from "./admin-staff-row";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminStaffConsole({ ownedShops }: { ownedShops: ShopMembership[] }) {
  const activeOwnedShops = ownedShops.filter((s) => !s.archivedAt);
  const shopIds = activeOwnedShops.map((s) => s.shopId);

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, user_id, shop_id, display_name, role")
    .in("shop_id", shopIds)
    .order("role");

  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers();
  const emailByUserId = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));
  const shopNameById = new Map(activeOwnedShops.map((s) => [s.shopId, s.shopName]));

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Staff</h1>
      <p className="mt-1 text-sm text-muted">Every staff member across your active branches.</p>

      <div className="stagger mt-6 flex flex-col gap-3">
        {(members ?? []).length === 0 ? (
          <p className="text-sm text-muted">No staff at any of your branches yet.</p>
        ) : (
          (members ?? []).map((m) => (
            <AdminStaffRow
              key={m.id}
              profileId={m.id}
              displayName={m.display_name}
              email={emailByUserId.get(m.user_id) ?? "unknown"}
              role={m.role}
              currentShopId={m.shop_id}
              currentShopName={shopNameById.get(m.shop_id) ?? ""}
              otherShops={activeOwnedShops.filter((s) => s.shopId !== m.shop_id)}
            />
          ))
        )}
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Add staff to a branch</h2>
      <div className="mt-2">
        <AdminInviteForm shops={activeOwnedShops} />
      </div>
    </main>
  );
}
