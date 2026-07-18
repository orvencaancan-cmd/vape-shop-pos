import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { ReceiveStockForm } from "./receive-stock-form";

type VariantRow = {
  id: string;
  product_id: string;
  flavor: string | null;
  nicotine_mg: number | null;
  size: string | null;
  sku: string | null;
  price: number;
  stock_qty: number;
  low_stock_threshold: number;
};

type ProductRow = {
  id: string;
  name: string;
  category: "ejuice" | "accessory";
};

export default async function InventoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const [{ data: products }, { data: variants }, { data: suppliers }, { data: receipts }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, category")
        .eq("archived", false)
        .order("name"),
      supabase
        .from("variants")
        .select(
          "id, product_id, flavor, nicotine_mg, size, sku, price, stock_qty, low_stock_threshold",
        ),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase
        .from("stock_receipts")
        .select("variant_id, received_at, suppliers(name)")
        .order("received_at", { ascending: false })
        .limit(300),
    ]);

  const latestSupplierByVariant = new Map<string, string>();
  for (const r of receipts ?? []) {
    if (!latestSupplierByVariant.has(r.variant_id) && r.suppliers) {
      const supplierName = Array.isArray(r.suppliers) ? r.suppliers[0]?.name : (r.suppliers as { name: string }).name;
      if (supplierName) latestSupplierByVariant.set(r.variant_id, supplierName);
    }
  }

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const v of (variants ?? []) as VariantRow[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
        {profile.role === "owner" && (
          <Link
            href="/inventory/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add product
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {(products as ProductRow[] | null)?.map((product) => {
          const productVariants = variantsByProduct.get(product.id) ?? [];
          return (
            <section key={product.id}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-lg font-medium text-slate-900">
                  {product.name}{" "}
                  <span className="text-xs font-normal uppercase text-slate-400">
                    {product.category}
                  </span>
                </h2>
                {profile.role === "owner" && (
                  <Link
                    href={`/inventory/${product.id}`}
                    className="text-sm text-slate-500 underline"
                  >
                    Edit
                  </Link>
                )}
              </div>

              {productVariants.length === 0 ? (
                <p className="py-3 text-sm text-slate-400">No variants yet.</p>
              ) : (
                <div className="mt-2 flex flex-col divide-y divide-slate-100">
                  {productVariants.map((v) => {
                    const isLow = v.stock_qty <= v.low_stock_threshold;
                    const label = [v.flavor, v.nicotine_mg != null ? `${v.nicotine_mg}mg` : null, v.size]
                      .filter(Boolean)
                      .join(" · ") || "Default";
                    return (
                      <div key={v.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="text-sm text-slate-800">{label}</span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              isLow ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {v.stock_qty} in stock
                          </span>
                          <span className="text-xs text-slate-400">
                            ${Number(v.price).toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {latestSupplierByVariant.get(v.id) ?? "no supplier logged"}
                          </span>
                        </div>
                        <ReceiveStockForm variantId={v.id} suppliers={suppliers ?? []} />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {(products?.length ?? 0) === 0 && (
          <p className="text-sm text-slate-400">
            No products yet.{" "}
            {profile.role === "owner" && (
              <Link href="/inventory/new" className="underline">
                Add your first one
              </Link>
            )}
          </p>
        )}
      </div>
    </main>
  );
}
