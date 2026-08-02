import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { InventoryList, type InventoryVariant } from "./inventory-list";

export default async function InventoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.inAdminOverview || (profile.shop.archived && profile.role === "owner")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const { data: variants } = await supabase
    .from("variants")
    .select(
      "id, product_id, flavor, nicotine_mg, size, for_device, ohms, price, cost, stock_qty, low_stock_threshold, products(name, brand, category, subcategory, archived, suppliers(name))",
    )
    .eq("shop_id", profile.shopId);

  const items: InventoryVariant[] = (variants ?? [])
    .map((v) => {
      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      if (!product || product.archived) return null;
      const supplierRow = Array.isArray(product.suppliers) ? product.suppliers[0] : product.suppliers;
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
        ohms: v.ohms != null ? Number(v.ohms) : null,
        price: Number(v.price),
        cost: Number(v.cost),
        stockQty: v.stock_qty as number,
        lowStockThreshold: v.low_stock_threshold as number,
        supplierName: (supplierRow?.name as string | undefined) ?? null,
      };
    })
    .filter((v): v is InventoryVariant => v !== null);

  return (
    <main className="animate-fade-in-up mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl">Inventory</h1>
        <Link
          href="/inventory/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
        >
          Add product
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No products yet.{" "}
          <Link href="/inventory/new" className="text-primary underline underline-offset-2">
            Add your first one
          </Link>
        </p>
      ) : (
        <InventoryList variants={items} canEdit={profile.role === "owner"} />
      )}
    </main>
  );
}
