import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { SupplierForm } from "./supplier-form";
import { deleteSupplierAction } from "./actions";

export default async function SuppliersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, contact_info")
    .order("name");

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-serif text-2xl font-normal text-ink">Suppliers</h1>

      <div className="stagger mt-6 flex flex-col gap-3">
        {(suppliers ?? []).map((s) => {
          const boundDelete = deleteSupplierAction.bind(null, s.id);
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg border border-hairline bg-canvas-soft p-3"
            >
              <div className="flex-1">
                <SupplierForm supplierId={s.id} name={s.name} contactInfo={s.contact_info} />
              </div>
              <form action={boundDelete}>
                <button type="submit" className="text-xs text-error underline">
                  Delete
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Add a supplier</h2>
      <div className="mt-2">
        <SupplierForm />
      </div>
    </main>
  );
}
