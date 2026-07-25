import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { AuditScreen, type AuditVariant, type AuditHistoryEntry } from "./audit-screen";

export default async function AuditPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.inAdminOverview || (profile.shop.archived && profile.role === "owner")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [{ data: variants }, { data: openAudit }, { data: completedAudits }] = await Promise.all([
    supabase
      .from("variants")
      .select(
        "id, flavor, nicotine_mg, size, for_device, ohms, cost, stock_qty, products(name, brand, category, archived)",
      )
      .eq("shop_id", profile.shopId),
    supabase
      .from("stock_audits")
      .select("id, started_at")
      .eq("shop_id", profile.shopId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("stock_audits")
      .select("id, started_at, completed_at, profiles!stock_audits_completed_by_fkey(display_name)")
      .eq("shop_id", profile.shopId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(10),
  ]);

  const items: AuditVariant[] = (variants ?? [])
    .map((v) => {
      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      if (!product || product.archived) return null;
      return {
        id: v.id as string,
        productName: product.name as string,
        brand: (product.brand as string | null) ?? null,
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
        stockQty: v.stock_qty as number,
        cost: Number(v.cost),
      };
    })
    .filter((v): v is AuditVariant => v !== null);

  let existingCounts: { variantId: string; countedQty: number }[] = [];
  if (openAudit) {
    const { data: lines } = await supabase
      .from("stock_audit_lines")
      .select("variant_id, counted_qty")
      .eq("audit_id", openAudit.id);
    existingCounts = (lines ?? []).map((l) => ({
      variantId: l.variant_id as string,
      countedQty: l.counted_qty as number,
    }));
  }

  const completedIds = (completedAudits ?? []).map((a) => a.id as string);
  const { data: historyLines } = completedIds.length
    ? await supabase
        .from("stock_audit_lines")
        .select("audit_id, system_qty, counted_qty, variants(cost, flavor, nicotine_mg, size, for_device, ohms, products(name, brand))")
        .in("audit_id", completedIds)
    : { data: [] };

  const history: AuditHistoryEntry[] = (completedAudits ?? []).map((a) => {
    const completer = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    const linesForAudit = (historyLines ?? []).filter((l) => l.audit_id === a.id);
    const discrepancies = linesForAudit
      .filter((l) => (l.system_qty as number) !== (l.counted_qty as number))
      .map((l) => {
        const variant = Array.isArray(l.variants) ? l.variants[0] : l.variants;
        const product = variant ? (Array.isArray(variant.products) ? variant.products[0] : variant.products) : null;
        const label =
          [
            variant?.flavor,
            variant?.nicotine_mg != null ? `${variant.nicotine_mg}mg` : null,
            variant?.size,
            variant?.for_device ? `For ${variant.for_device}` : null,
            variant?.ohms != null ? `${variant.ohms}Ω` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Default";
        const diff = (l.counted_qty as number) - (l.system_qty as number);
        return {
          item: `${product?.brand ? `${product.brand} — ` : ""}${product?.name ?? "Unknown product"} — ${label}`,
          systemQty: l.system_qty as number,
          countedQty: l.counted_qty as number,
          diff,
          valueImpact: diff * Number(variant?.cost ?? 0),
        };
      });
    return {
      id: a.id as string,
      startedAt: a.started_at as string,
      completedAt: a.completed_at as string,
      completedByName: (completer?.display_name as string | null) ?? null,
      itemsCounted: linesForAudit.length,
      discrepancies,
    };
  });

  return (
    <main className="animate-fade-in-up mx-auto max-w-5xl px-4 py-8">
      <h1 className="heading text-2xl">{profile.shop.name} — Audit</h1>
      <AuditScreen
        variants={items}
        openAuditId={(openAudit?.id as string) ?? null}
        existingCounts={existingCounts}
        history={history}
      />
    </main>
  );
}
