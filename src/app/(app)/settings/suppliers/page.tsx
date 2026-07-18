import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { SupplierForm } from "./supplier-form";
import { deleteSupplierAction } from "./actions";

export default async function SuppliersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, contact_info")
    .order("name");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Suppliers</h1>

      <div className="mt-6 flex flex-col gap-3">
        {(suppliers ?? []).map((s) => {
          const boundDelete = deleteSupplierAction.bind(null, s.id);
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
              <div className="flex-1">
                <SupplierForm supplierId={s.id} name={s.name} contactInfo={s.contact_info} />
              </div>
              <form action={boundDelete}>
                <button type="submit" className="text-xs text-red-600 underline">
                  Delete
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-sm font-medium text-slate-500">Add a supplier</h2>
      <div className="mt-2">
        <SupplierForm />
      </div>
    </main>
  );
}
