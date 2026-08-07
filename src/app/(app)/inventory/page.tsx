import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { fetchPendingInventoryTransfers } from "@/lib/inventory-transfer";
import { IncomingInventoryChecklist, OutgoingInventoryList } from "@/components/inventory-transfer-checklist";
import { InventoryList, type InventoryVariant } from "./inventory-list";
import { SendStockForm } from "./send-stock-form";

export default async function InventoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.inAdminOverview || (profile.shop.archived && profile.role === "owner")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [{ data: variants }, { data: supplierRows }, { data: restockRows }, pendingTransfers] = await Promise.all([
    supabase
      .from("variants")
      .select(
        "id, product_id, flavor, nicotine_mg, size, for_device, ohms, price, cost, stock_qty, low_stock_threshold, products(name, brand, category, subcategory, archived, suppliers(name))",
      )
      .eq("shop_id", profile.shopId),
    supabase.from("suppliers").select("name").eq("shop_id", profile.shopId).order("name"),
    supabase.rpc("get_last_restock_dates", { p_shop_id: profile.shopId }),
    fetchPendingInventoryTransfers(supabase),
  ]);
  const incomingTransfers = pendingTransfers.filter(
    (t) => t.destinationType === "branch" && t.destinationShopId === profile.shopId,
  );
  const outgoingTransfers = pendingTransfers.filter(
    (t) => t.sourceType === "branch" && t.sourceShopId === profile.shopId,
  );
  const otherBranches = profile.shops
    .filter((s) => s.role === "owner" && !s.archivedAt && s.shopId !== profile.shopId)
    .map((s) => ({ shopId: s.shopId, shopName: s.shopName }));
  const supplierNames = [...new Set((supplierRows ?? []).map((s) => s.name))];
  const lastRestockedByVariant = new Map(
    ((restockRows ?? []) as { variant_id: string; last_restocked_at: string }[]).map((r) => [
      r.variant_id,
      r.last_restocked_at,
    ]),
  );

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
        lastRestockedAt: lastRestockedByVariant.get(v.id as string) ?? null,
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

      {profile.role === "owner" && (
        <div className="mt-4">
          <SendStockForm shopId={profile.shopId} variants={items} branches={otherBranches} />
        </div>
      )}

      {(incomingTransfers.length > 0 || outgoingTransfers.length > 0) && (
        <div className="mt-4 flex flex-col gap-3">
          <IncomingInventoryChecklist transfers={incomingTransfers} />
          <OutgoingInventoryList transfers={outgoingTransfers} canCancel={profile.role === "owner"} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No products yet.{" "}
          <Link href="/inventory/new" className="text-primary underline underline-offset-2">
            Add your first one
          </Link>
        </p>
      ) : (
        <InventoryList
          variants={items}
          supplierNames={supplierNames}
          canEdit={profile.role === "owner"}
        />
      )}
    </main>
  );
}
