import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { InventoryList, type InventoryVariant } from "./inventory-list";

export default async function InventoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const [{ data: variants }, { data: suppliers }, { data: receipts }] = await Promise.all([
    supabase
      .from("variants")
      .select(
        "id, product_id, flavor, nicotine_mg, size, for_device, price, stock_qty, low_stock_threshold, products(name, brand, category, subcategory, archived)",
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
      const supplierName = Array.isArray(r.suppliers)
        ? r.suppliers[0]?.name
        : (r.suppliers as { name: string }).name;
      if (supplierName) latestSupplierByVariant.set(r.variant_id, supplierName);
    }
  }

  const items: InventoryVariant[] = (variants ?? [])
    .map((v) => {
      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      if (!product || product.archived) return null;
      return {
        id: v.id as string,
        productId: v.product_id as string,
        productName: product.name as string,
        brand: (product.brand as string | null) ?? null,
        category: product.category as "ejuice" | "accessory",
        subcategory: (product.subcategory as string | null) ?? null,
        flavor: v.flavor as string | null,
        nicotineMg: v.nicotine_mg as number | null,
        size: v.size as string | null,
        forDevice: v.for_device as string | null,
        price: Number(v.price),
        stockQty: v.stock_qty as number,
        lowStockThreshold: v.low_stock_threshold as number,
        latestSupplier: latestSupplierByVariant.get(v.id as string) ?? null,
      };
    })
    .filter((v): v is InventoryVariant => v !== null);

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

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">
          No products yet.{" "}
          {profile.role === "owner" && (
            <Link href="/inventory/new" className="underline">
              Add your first one
            </Link>
          )}
        </p>
      ) : (
        <InventoryList
          variants={items}
          suppliers={suppliers ?? []}
          canEdit={profile.role === "owner"}
        />
      )}
    </main>
  );
}
