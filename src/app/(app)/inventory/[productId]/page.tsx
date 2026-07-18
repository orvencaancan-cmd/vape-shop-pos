import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { ProductEditForm } from "./product-edit-form";
import { VariantForm } from "./variant-form";
import { archiveProductAction } from "../actions";

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
    .select("id, name, category, description")
    .eq("id", productId)
    .maybeSingle();
  if (!product) notFound();

  const { data: variants } = await supabase
    .from("variants")
    .select("id, flavor, nicotine_mg, size, sku, cost, price, stock_qty, low_stock_threshold")
    .eq("product_id", productId)
    .order("created_at");

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
            category={product.category}
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
            <VariantForm
              key={v.id}
              productId={product.id}
              variantId={v.id}
              values={{
                flavor: v.flavor,
                nicotineMg: v.nicotine_mg,
                size: v.size,
                sku: v.sku,
                cost: v.cost,
                price: v.price,
                lowStockThreshold: v.low_stock_threshold,
              }}
            />
          ))}
        </div>

        <h3 className="mt-6 text-xs font-medium uppercase text-slate-400">
          Add a new variant
        </h3>
        <div className="mt-2">
          <VariantForm productId={product.id} />
        </div>
      </section>
    </main>
  );
}
