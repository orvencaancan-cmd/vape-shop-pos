import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { SellScreen } from "./sell-screen";

export default async function SellPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: variants } = await supabase
    .from("variants")
    .select("id, flavor, nicotine_mg, size, price, stock_qty, products(name, category, archived)")
    .order("created_at");

  const items = (variants ?? [])
    .map((v) => {
      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      if (!product || product.archived) return null;
      return {
        id: v.id as string,
        productName: product.name as string,
        category: product.category as "ejuice" | "accessory",
        label:
          [v.flavor, v.nicotine_mg != null ? `${v.nicotine_mg}mg` : null, v.size]
            .filter(Boolean)
            .join(" · ") || "Default",
        price: Number(v.price),
        stockQty: v.stock_qty as number,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return (
    <main>
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <h1 className="text-2xl font-semibold text-slate-900">{profile.shop.name} — Sell</h1>
      </div>
      <SellScreen variants={items} />
    </main>
  );
}
