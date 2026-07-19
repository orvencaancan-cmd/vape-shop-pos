import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { ProductEditForm } from "./product-edit-form";
import { VariantForm } from "./variant-form";
import { archiveProductAction } from "../actions";
import { ReceiveStockForm } from "../receive-stock-form";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, name, brand, category, subcategory, description")
    .eq("id", productId)
    .maybeSingle();
  if (!product) notFound();

  const { data: variants } = await supabase
    .from("variants")
    .select(
      "id, flavor, nicotine_mg, size, for_device, sku, cost, price, stock_qty, low_stock_threshold",
    )
    .eq("product_id", productId)
    .order("created_at");

  const { data: suppliers } = await supabase.from("suppliers").select("id, name").order("name");

  const boundArchive = archiveProductAction.bind(null, productId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-slate-500">Product details</h2>
        <div className="mt-2">
          <ProductEditForm
            productId={product.id}
            name={product.name}
            brand={product.brand}
            category={product.category}
            subcategory={product.subcategory}
            description={product.description}
          />
        </div>
        <form action={boundArchive} className="mt-3">
          <button type="submit" className="text-xs text-red-600 underline">
            Archive product
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-slate-500">Variants</h2>
        <div className="mt-2 flex flex-col gap-3">
          {(variants ?? []).map((v) => (
            <div key={v.id} className="flex flex-col gap-2">
              <VariantForm
                productId={product.id}
                productCategory={product.category}
                variantId={v.id}
                values={{
                  flavor: v.flavor,
                  nicotineMg: v.nicotine_mg,
                  size: v.size,
                  forDevice: v.for_device,
                  sku: v.sku,
                  cost: v.cost,
                  price: v.price,
                  lowStockThreshold: v.low_stock_threshold,
                }}
              />
              <div className="flex items-center gap-2 pl-3 text-xs text-slate-500">
                <span className="shrink-0">{v.stock_qty} in stock —</span>
                <ReceiveStockForm variantId={v.id} suppliers={suppliers ?? []} />
              </div>
            </div>
          ))}
        </div>

        <h3 className="mt-6 text-xs font-medium uppercase text-slate-400">
          Add a new variant
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          New variants start at 0 in stock — after saving, use the &quot;Receive
          stock&quot; row that appears next to it above to log your starting quantity.
        </p>
        <div className="mt-2">
          <VariantForm productId={product.id} productCategory={product.category} />
        </div>
      </section>
    </main>
  );
}
