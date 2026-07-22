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
    .select(
      "id, flavor, nicotine_mg, size, for_device, ohms, price, stock_qty, products(name, category, archived)",
    )
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
          [
            v.flavor,
            v.nicotine_mg != null ? `${v.nicotine_mg}mg` : null,
            v.size,
            v.for_device ? `For ${v.for_device}` : null,
            v.ohms != null ? `${v.ohms}Ω` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Default",
        price: Number(v.price),
        stockQty: v.stock_qty as number,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const { data: recentSalesRaw } = await supabase
    .from("sales")
    .select("id, total, created_at, created_by, voided_at, profiles!sales_created_by_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(20);

  const recentSales = (recentSalesRaw ?? []).map((s) => {
    const creator = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return {
      id: s.id as string,
      total: Number(s.total),
      createdAt: s.created_at as string,
      createdByName: (creator?.display_name as string | null) ?? null,
      voidedAt: s.voided_at as string | null,
      canVoid: !s.voided_at && (profile.role === "owner" || s.created_by === profile.id),
    };
  });

  return (
    <main className="animate-fade-in-up">
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <h1 className="font-serif text-2xl font-normal text-ink">{profile.shop.name} — Sell</h1>
      </div>
      <SellScreen variants={items} recentSales={recentSales} />
    </main>
  );
}
